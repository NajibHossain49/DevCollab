import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ZodError, type ZodSchema } from "zod";

import { ValidationError } from "../utils/errors.js";

// Validates `req.body` against a Zod schema. On failure, converts the ZodError
// into a `path -> messages` map and forwards a ValidationError (see 10.6).
export function validate<T>(schema: ZodSchema<T>): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details: Record<string, string[]> = {};
        for (const issue of error.issues) {
          const path = issue.path.join(".");
          const existing = details[path] ?? [];
          existing.push(issue.message);
          details[path] = existing;
        }
        next(new ValidationError("Validation failed", details));
      } else {
        next(error);
      }
    }
  };
}
