import type { NextFunction, Request, RequestHandler, Response } from "express";
import { RateLimiterRedis } from "rate-limiter-flexible";

import { logger } from "../config/logger.js";
import { redis } from "../config/redis.js";
import { AppError } from "../utils/errors.js";

function createLimiter(keyPrefix: string, points: number, duration: number): RateLimiterRedis {
  return new RateLimiterRedis({
    storeClient: redis,
    keyPrefix,
    points,
    duration,
  });
}

// Limits per .cursor/rules.md Section 12.1.
const limiters = {
  auth: createLimiter("rl_auth", 5, 60),
  roomCreate: createLimiter("rl_room_create", 10, 60 * 60),
  execution: createLimiter("rl_execution", 10, 60),
  ai: createLimiter("rl_ai", 30, 60),
  aiExplain: createLimiter("rl_ai_explain", 20, 60),
} as const;

// Wraps a limiter as Express middleware. Keyed by user id when available,
// otherwise by client IP.
function rateLimit(limiter: RateLimiterRedis): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const key = req.user?.id ?? req.ip ?? "unknown";
    try {
      await limiter.consume(key);
      next();
    } catch (rejection) {
      // A thrown Error means the store failed; anything else is a limit hit.
      if (rejection instanceof Error) {
        next(rejection);
        return;
      }
      logger.warn({ key, keyPrefix: limiter.keyPrefix }, "Rate limit exceeded");
      next(new AppError("RATE_LIMITED", "Too many requests, please try again later.", 429));
    }
  };
}

export const authLimiter: RequestHandler = rateLimit(limiters.auth);
export const roomCreateLimiter: RequestHandler = rateLimit(limiters.roomCreate);
export const executionLimiter: RequestHandler = rateLimit(limiters.execution);
export const aiLimiter: RequestHandler = rateLimit(limiters.ai);
export const aiExplainLimiter: RequestHandler = rateLimit(limiters.aiExplain);
