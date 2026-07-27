import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ZodError, type ZodSchema } from "zod";

import { ValidationError } from "../utils/errors.js";

type RequestSource = "body" | "params" | "query";

function makeValidator<T>(schema: ZodSchema<T>, source: RequestSource): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      schema.parse(req[source]);
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

// Validates `req.body` against a Zod schema (see .cursor/rules.md 10.6).
export function validate<T>(schema: ZodSchema<T>): RequestHandler {
  return makeValidator(schema, "body");
}

// Validates `req.params` against a Zod schema.
export function validateParams<T>(schema: ZodSchema<T>): RequestHandler {
  return makeValidator(schema, "params");
}

// Validates `req.query` against a Zod schema.
export function validateQuery<T>(schema: ZodSchema<T>): RequestHandler {
  return makeValidator(schema, "query");
}
