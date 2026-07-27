import { Redis } from "ioredis";

import { env } from "./env.js";
import { logger } from "./logger.js";

function createRedisClient(): Redis {
  // maxRetriesPerRequest: null keeps commands queued during reconnects, which
  // is the recommended setting for rate-limiter-flexible.
  const client = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

  client.on("connect", () => {
    logger.info("Redis connected");
  });

  client.on("error", (error: Error) => {
    logger.error({ error }, "Redis connection error");
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
