import { Redis } from "ioredis";

import { env } from "./env.js";
import { logger } from "./logger.js";

// While Redis is unreachable, don't spam an error line on every retry — log at
// most once per this window until it recovers.
const ERROR_LOG_THROTTLE_MS = 30_000;

function createRedisClient(): Redis {
  // maxRetriesPerRequest: null keeps commands queued during reconnects, which
  // is the recommended setting for rate-limiter-flexible.
  const client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    // Exponential backoff capped at 5s so we don't hammer a downed Redis.
    retryStrategy: (attempt: number): number => Math.min(attempt * 200, 5_000),
  });

  let isConnected = false;
  let lastErrorLoggedAt = 0;

  client.on("ready", () => {
    isConnected = true;
    lastErrorLoggedAt = 0;
    logger.info("Redis connected");
  });

  client.on("close", () => {
    if (isConnected) {
      isConnected = false;
      logger.warn("Redis connection closed");
    }
  });

  client.on("error", (error: Error) => {
    const now = Date.now();
    // Always log the first failure; afterwards throttle while still down.
    if (isConnected || now - lastErrorLoggedAt >= ERROR_LOG_THROTTLE_MS) {
      lastErrorLoggedAt = now;
      logger.error({ error }, "Redis connection error");
    }
  });

  return client;
}

// Reuse a single Redis client across hot-reloads in development.
const globalForRedis = globalThis as unknown as {
  redis?: Redis;
};

export const redis: Redis = globalForRedis.redis ?? createRedisClient();

if (env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}
