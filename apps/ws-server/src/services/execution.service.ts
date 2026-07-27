import { ExecutionStatus, type Execution } from "@prisma/client";

import { prisma } from "../config/database.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { AppError, DatabaseError } from "../utils/errors.js";

// Judge0 language ids (see .cursor/rules.md Section 8.1).
const JUDGE0_LANGUAGE_IDS: Record<string, number> = {
  javascript: 63,
  typescript: 74,
  python: 71,
  java: 62,
  cpp: 54,
  go: 60,
  rust: 73,
};

const MAX_POLL_MS = 5000;
const POLL_INTERVAL_MS = 500;

interface Judge0SubmissionResponse {
  token: string;
}

interface Judge0ResultResponse {
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  message: string | null;
  time: string | null;
  status: { id: number; description: string };
}

function judge0Headers(): Record<string, string> {
  const host = new URL(env.JUDGE0_API_URL).host;
  return {
    "Content-Type": "application/json",
    "X-RapidAPI-Key": env.JUDGE0_API_KEY,
    "X-RapidAPI-Host": host,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Maps a Judge0 status id to our ExecutionStatus enum.
function mapJudge0Status(statusId: number): ExecutionStatus {
  if (statusId === 3) {
    return ExecutionStatus.SUCCESS;
  }
  if (statusId === 5) {
    return ExecutionStatus.TIMEOUT;
  }
  return ExecutionStatus.ERROR;
}

async function createSubmission(code: string, languageId: number): Promise<string> {
  const response = await fetch(
    `${env.JUDGE0_API_URL}/submissions?base64_encoded=false&wait=false`,
    {
      method: "POST",
      headers: judge0Headers(),
      body: JSON.stringify({ source_code: code, language_id: languageId, stdin: "" }),
    },
  );

  if (!response.ok) {
    throw new AppError("EXECUTION_FAILED", `Judge0 submission failed (${response.status})`, 502);
  }

  const data = (await response.json()) as Judge0SubmissionResponse;
  return data.token;
}

async function pollSubmission(token: string): Promise<Judge0ResultResponse> {
  const deadline = Date.now() + MAX_POLL_MS;

  for (;;) {
    const response = await fetch(
      `${env.JUDGE0_API_URL}/submissions/${token}?base64_encoded=false`,
      { headers: judge0Headers() },
    );

    if (!response.ok) {
      throw new AppError("EXECUTION_FAILED", `Judge0 polling failed (${response.status})`, 502);
    }

    const result = (await response.json()) as Judge0ResultResponse;

    // Status ids 1 (In Queue) and 2 (Processing) mean we should keep polling.
    if (result.status.id > 2) {
      return result;
    }
    if (Date.now() >= deadline) {
      return result;
    }
    await sleep(POLL_INTERVAL_MS);
  }
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

  const languageId = JUDGE0_LANGUAGE_IDS[language];
  if (languageId === undefined) {
    logger.warn({ executionId: execution.id, language }, "Unsupported execution language");
    return finalizeExecution(execution.id, {
      status: ExecutionStatus.ERROR,
      error: `Unsupported language: ${language}`,
    });
  }

  const startedAt = Date.now();
  try {
    const token = await createSubmission(code, languageId);
    const result = await pollSubmission(token);
    const status = Date.now() - startedAt >= MAX_POLL_MS && result.status.id <= 2
      ? ExecutionStatus.TIMEOUT
      : mapJudge0Status(result.status.id);

    logger.info({ executionId: execution.id, roomId, status }, "Code execution finished");
    return finalizeExecution(execution.id, {
      status,
      output: result.stdout,
      error: result.stderr ?? result.compile_output ?? result.message,
      executionTime: result.time ? Math.round(Number.parseFloat(result.time) * 1000) : Date.now() - startedAt,
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
