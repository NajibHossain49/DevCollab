import type { User } from "@prisma/client";
import type { NextFunction, Request, RequestHandler, Response } from "express";

import { UnauthorizedError } from "./errors.js";

// Wraps an async route handler so rejected promises are forwarded to Express'
// error-handling middleware instead of crashing the process.
export function asyncHandler(fn: RequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Returns the authenticated user, narrowing the optional `req.user`.
// Must be used after the `verifyAuth` middleware.
export function getUser(req: Request): User {
  if (!req.user) {
    throw new UnauthorizedError("Authentication required");
  }
  return req.user;
}
