import { ExecutionStatus, type Execution } from "@prisma/client";

import { prisma } from "../config/database.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { AppError, DatabaseError } from "../utils/errors.js";

// Maps our language keys to Piston language names + source file names. Piston
// selects a runtime from the `language` (or an alias) and the requested version.
const PISTON_LANGUAGES: Record<string, { language: string; filename: string }> = {
  javascript: { language: "javascript", filename: "main.js" },
  typescript: { language: "typescript", filename: "main.ts" },
  python: { language: "python", filename: "main.py" },
  // Java's public class must match the file name; user code should declare `Main`.
  java: { language: "java", filename: "Main.java" },
  cpp: { language: "c++", filename: "main.cpp" },
  go: { language: "go", filename: "main.go" },
  rust: { language: "rust", filename: "main.rs" },
};

const COMPILE_TIMEOUT_MS = 10_000;
const RUN_TIMEOUT_MS = 5_000;
const RUNTIMES_CACHE_TTL_MS = 5 * 60_000;

interface PistonRuntime {
  language: string;
  version: string;
  aliases: string[];
}

interface PistonStage {
  stdout: string;
  stderr: string;
  output: string;
  code: number | null;
  signal: string | null;
}

interface PistonExecuteResponse {
  language: string;
  version: string;
  run: PistonStage;
  compile?: PistonStage;
}

// Builds a Piston endpoint URL, tolerating both an emkc-style base that already
// contains the versioned path (…/api/v2/piston) and a bare self-hosted host
// (http://localhost:2000), for which we append /api/v2.
function pistonUrl(resource: "execute" | "runtimes"): string {
  const base = env.PISTON_API_URL.replace(/\/+$/, "");
  return base.includes("/api/v2")
    ? `${base}/${resource}`
    : `${base}/api/v2/${resource}`;
}

let runtimesCache: { runtimes: PistonRuntime[]; fetchedAt: number } | null = null;

// Fetches (and caches) the list of runtimes so we can resolve a concrete
// version for a language. Failures are non-fatal — callers fall back to "*".
async function getRuntimes(): Promise<PistonRuntime[]> {
  if (runtimesCache && Date.now() - runtimesCache.fetchedAt < RUNTIMES_CACHE_TTL_MS) {
    return runtimesCache.runtimes;
  }

  const response = await fetch(pistonUrl("runtimes"));
  if (!response.ok) {
    throw new AppError("EXECUTION_FAILED", `Piston runtimes lookup failed (${response.status})`, 502);
  }

  const runtimes = (await response.json()) as PistonRuntime[];
  runtimesCache = { runtimes, fetchedAt: Date.now() };
  return runtimes;
}

// Resolves the latest available version for a Piston language. Returns "*"
// (Piston's "any version" selector) if the runtime list can't be consulted.
async function resolveVersion(pistonLanguage: string): Promise<string> {
  try {
    const runtimes = await getRuntimes();
    const match = runtimes.find(
      (runtime) =>
        runtime.language === pistonLanguage ||
        runtime.aliases.includes(pistonLanguage),
    );
    return match?.version ?? "*";
  } catch (error) {
    logger.warn({ error, pistonLanguage }, "Falling back to version '*' for Piston");
    return "*";
  }
}

async function runOnPiston(
  code: string,
  mapping: { language: string; filename: string },
): Promise<PistonExecuteResponse> {
  const version = await resolveVersion(mapping.language);

  const response = await fetch(pistonUrl("execute"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      language: mapping.language,
      version,
      files: [{ name: mapping.filename, content: code }],
      stdin: "",
      args: [],
      compile_timeout: COMPILE_TIMEOUT_MS,
      run_timeout: RUN_TIMEOUT_MS,
    }),
  });

  if (!response.ok) {
    throw new AppError("EXECUTION_FAILED", `Piston execute failed (${response.status})`, 502);
  }

  return (await response.json()) as PistonExecuteResponse;
}

// Derives our ExecutionStatus from a Piston result. A killed signal indicates a
// timeout; a non-zero compile or run exit code is an error.
function mapPistonStatus(result: PistonExecuteResponse): ExecutionStatus {
  if (result.compile && result.compile.code !== 0) {
    return ExecutionStatus.ERROR;
  }
  if (result.run.signal === "SIGKILL") {
    return ExecutionStatus.TIMEOUT;
  }
  return result.run.code === 0 ? ExecutionStatus.SUCCESS : ExecutionStatus.ERROR;
}

export async function executeCode(
  roomId: string,
  userId: string,
  code: string,
  language: string,
): Promise<Execution> {
  let execution: Execution;
  try {
    execution = await prisma.execution.create({
      data: {
        roomId,
        code,
        language,
        status: ExecutionStatus.PENDING,
        executedById: userId,
      },
    });
  } catch (error) {
    logger.error({ error, roomId, userId }, "Failed to create execution record");
    throw new DatabaseError("Failed to create execution");
  }

  const mapping = PISTON_LANGUAGES[language];
  if (mapping === undefined) {
    logger.warn({ executionId: execution.id, language }, "Unsupported execution language");
    return finalizeExecution(execution.id, {
      status: ExecutionStatus.ERROR,
      error: `Unsupported language: ${language}`,
    });
  }

  const startedAt = Date.now();
  try {
    const result = await runOnPiston(code, mapping);
    const status = mapPistonStatus(result);

    // Prefer a compile error message when compilation failed, otherwise runtime stderr.
    const compileError =
      result.compile && result.compile.code !== 0 ? result.compile.stderr : null;

    logger.info({ executionId: execution.id, roomId, status }, "Code execution finished");
    return finalizeExecution(execution.id, {
      status,
      output: result.run.stdout || null,
      error: compileError || result.run.stderr || null,
      executionTime: Date.now() - startedAt,
    });
  } catch (error) {
    logger.error({ error, executionId: execution.id, roomId }, "Code execution failed");
    return finalizeExecution(execution.id, {
      status: ExecutionStatus.ERROR,
      error: error instanceof Error ? error.message : "Execution failed",
    });
  }
}

interface FinalizeData {
  status: ExecutionStatus;
  output?: string | null;
  error?: string | null;
  executionTime?: number;
}

async function finalizeExecution(executionId: string, data: FinalizeData): Promise<Execution> {
  try {
    return await prisma.execution.update({
      where: { id: executionId },
      data: {
        status: data.status,
        output: data.output ?? null,
        error: data.error ?? null,
        executionTime: data.executionTime ?? null,
      },
    });
  } catch (error) {
    logger.error({ error, executionId }, "Failed to finalize execution");
    throw new DatabaseError("Failed to update execution");
  }
}

export async function getExecutionHistory(
  roomId: string,
  page: number,
  limit: number,
): Promise<{ executions: Execution[]; total: number }> {
  const skip = Math.max(0, (page - 1) * limit);

  try {
    const [executions, total] = await prisma.$transaction([
      prisma.execution.findMany({
        where: { roomId },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.execution.count({ where: { roomId } }),
    ]);

    logger.info({ roomId, page, limit, total }, "Listed execution history");
    return { executions, total };
  } catch (error) {
    logger.error({ error, roomId }, "Failed to list execution history");
    throw new DatabaseError("Failed to list execution history");
  }
}
