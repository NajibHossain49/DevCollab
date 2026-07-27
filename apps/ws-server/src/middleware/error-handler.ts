import type { NextFunction, Request, Response } from "express";

import { logger } from "../config/logger.js";
import { AppError } from "../utils/errors.js";

interface ErrorResponseBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}

// Centralized Express error handler. Must keep the 4-arg signature so Express
// recognizes it as an error-handling middleware.
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    logger.warn(
      { code: err.code, statusCode: err.statusCode, path: req.path, details: err.details },
      err.message,
    );

    const body: ErrorResponseBody = {
      success: false,
      error: { code: err.code, message: err.message },
    };
    if (err.details) {
      body.error.details = err.details;
    }

    res.status(err.statusCode).json(body);
    return;
  }

  const error = err instanceof Error ? err : new Error("Unknown error");
  logger.error(
    { err: error, stack: error.stack, path: req.path, method: req.method },
    "Unhandled error",
  );

  const body: ErrorResponseBody = {
    success: false,
    error: { code: "INTERNAL_ERROR", message: "Internal server error" },
  };
  res.status(500).json(body);
}
