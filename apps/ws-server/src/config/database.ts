import { PrismaClient } from "@prisma/client";

import { env } from "./env.js";
import { logger } from "./logger.js";

const isDevelopment = env.NODE_ENV === "development";

function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log: [
      { emit: "event", level: "query" },
      { emit: "event", level: "warn" },
      { emit: "event", level: "error" },
    ],
  });

  // Log every query in development only (kept quiet in prod/test).
  if (isDevelopment) {
    client.$on("query", (event) => {
      logger.debug(
        { query: event.query, params: event.params, duration: `${event.duration}ms` },
        "prisma query",
      );
    });
  }

  client.$on("warn", (event) => {
    logger.warn({ target: event.target }, event.message);
  });

  client.$on("error", (event) => {
    logger.error({ target: event.target }, event.message);
  });

  return client;
}

// Reuse a single PrismaClient across hot-reloads in development to avoid
// exhausting the database connection pool.
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (!globalForPrisma.prisma) {
  logger.info("Prisma client initialized");
  if (env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma;
  }
}
