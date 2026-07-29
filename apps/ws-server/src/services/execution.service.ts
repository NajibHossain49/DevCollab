import { ExecutionStatus, type Execution } from "@prisma/client";

import { prisma } from "../config/database.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { AppError, DatabaseError } from "../utils/errors.js";

// Maps our language keys to the code-execution service's language slugs.
// TypeScript is transpiled and run server-side (slug "ts"); Rust is compiled
// with rustc (slug "rs"). Unmapped languages are rejected.
const CODEX_LANGUAGES: Record<string, string> = {
  javascript: "js",
  typescript: "ts",
  python: "py",
  java: "java",
  cpp: "cpp",
  go: "go",
  rust: "rs",
};

// Abort the request if the execution service takes longer than this. Kept high
// because a free-tier host can take ~30-60s to cold-start from sleep before it
// even begins running the code.
const REQUEST_TIMEOUT_MS = 75_000;

interface CodexResponse {
  timeStamp?: number;
  status?: number;
  output?: string;
  error?: string;
}

// Sends the code to the Codex API as form-urlencoded data and returns the
// parsed response. Throws an AppError on transport / non-2xx failures.
async function runOnCodex(
  code: string,
  codexLanguage: string,
  input: string,
): Promise<CodexResponse> {
  const body = new URLSearchParams({ code, language: codexLanguage, input });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(env.CODEX_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new AppError("EXECUTION_FAILED", `Codex execute failed (${response.status})`, 502);
  }

  return (await response.json()) as CodexResponse;
}

// Codex returns compile / runtime problems in `error`. Treat a non-empty error
// as a failed run; otherwise the run succeeded.
function mapCodexStatus(result: CodexResponse): ExecutionStatus {
  const hasError = typeof result.error === "string" && result.error.trim().length > 0;
  return hasError ? ExecutionStatus.ERROR : ExecutionStatus.SUCCESS;
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

  const codexLanguage = CODEX_LANGUAGES[language];
  if (codexLanguage === undefined) {
    logger.warn({ executionId: execution.id, language }, "Unsupported execution language");
    return finalizeExecution(execution.id, {
      status: ExecutionStatus.ERROR,
      error: `Unsupported language: ${language}`,
    });
  }

  const startedAt = Date.now();
  try {
    const result = await runOnCodex(code, codexLanguage, "");
    const status = mapCodexStatus(result);

    logger.info({ executionId: execution.id, roomId, status }, "Code execution finished");
    return finalizeExecution(execution.id, {
      status,
      output: result.output?.trim() ? result.output : null,
      error: result.error?.trim() ? result.error : null,
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

// Permanently deletes every execution record for a room. Returns how many rows
// were removed. Used by the room owner to clear run history.
export async function clearExecutionHistory(roomId: string): Promise<number> {
  try {
    const { count } = await prisma.execution.deleteMany({ where: { roomId } });
    logger.info({ roomId, count }, "Cleared execution history");
    return count;
  } catch (error) {
    logger.error({ error, roomId }, "Failed to clear execution history");
    throw new DatabaseError("Failed to clear execution history");
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
