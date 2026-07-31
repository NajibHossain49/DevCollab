import { createServer, type Server } from "node:http";

import cors from "cors";
import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import type { WebSocketServer } from "ws";

import { corsOptions } from "./config/cors.js";
import { prisma } from "./config/database.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { redis } from "./config/redis.js";
import { errorHandler } from "./middleware/error-handler.js";
import apiRouter from "./routes/index.js";
import type { ApiResponse } from "./types/index.js";
import { connectionManager, sendMessage } from "./websocket/connection.js";
import { getWebSocketServer, setupWebSocketServer } from "./websocket/server.js";

// How long to wait for in-flight work before forcing exit during shutdown.
const SHUTDOWN_TIMEOUT_MS = 10_000;

// Cap each dependency probe so a hung dependency can't stall the health check.
const HEALTH_CHECK_TIMEOUT_MS = 3_000;

type DependencyStatus = "up" | "down";

interface HealthReport {
  status: "ok" | "degraded";
  timestamp: string;
  uptimeSeconds: number;
  services: {
    database: DependencyStatus;
    redis: DependencyStatus;
    websocket: DependencyStatus;
  };
  connections: number;
  // HTTP status the endpoint should return. Database and the WebSocket server
  // are critical (503 when down). Redis backs rate limiting only, so a Redis
  // outage is reported as "degraded" but still returns 200 to avoid the
  // platform restarting an otherwise-serving instance on a transient blip.
  httpStatus: 200 | 503;
}

// Rejects if the probe takes longer than HEALTH_CHECK_TIMEOUT_MS.
function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_resolve, reject) => {
      setTimeout(() => reject(new Error(`${label} health check timed out`)), HEALTH_CHECK_TIMEOUT_MS).unref();
    }),
  ]);
}

async function checkDatabase(): Promise<DependencyStatus> {
  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, "database");
    return "up";
  } catch (error) {
    logger.warn({ error }, "Database health check failed");
    return "down";
  }
}

async function checkRedis(): Promise<DependencyStatus> {
  try {
    const pong = await withTimeout(redis.ping(), "redis");
    return pong === "PONG" ? "up" : "down";
  } catch (error) {
    logger.warn({ error }, "Redis health check failed");
    return "down";
  }
}

function checkWebSocket(): DependencyStatus {
  return getWebSocketServer() ? "up" : "down";
}

async function buildHealthReport(): Promise<HealthReport> {
  const [database, redisStatus] = await Promise.all([checkDatabase(), checkRedis()]);
  const websocket = checkWebSocket();

  const allUp = database === "up" && redisStatus === "up" && websocket === "up";
  const criticalUp = database === "up" && websocket === "up";

  return {
    status: allUp ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    services: { database, redis: redisStatus, websocket },
    connections: connectionManager.getConnectionCount(),
    httpStatus: criticalUp ? 200 : 503,
  };
}

// Stripe webhook signature verification needs the untouched raw request body,
// so this path must bypass the JSON body parser.
const STRIPE_WEBHOOK_PATH = "/api/billing/webhook";

function isWebhookRequest(req: Request): boolean {
  return req.path === STRIPE_WEBHOOK_PATH;
}

function buildApp(): Express {
  const app = express();

  // 0. Raw body for the Stripe webhook only (before the JSON parser consumes it).
  app.use(STRIPE_WEBHOOK_PATH, express.raw({ type: "*/*" }));

  // 1 & 2. Body / form parsers — skipped for the webhook path.
  const jsonParser = express.json();
  const urlencodedParser = express.urlencoded({ extended: true });
  app.use((req: Request, res: Response, next: NextFunction): void => {
    if (isWebhookRequest(req)) {
      next();
      return;
    }
    jsonParser(req, res, next);
  });
  app.use((req: Request, res: Response, next: NextFunction): void => {
    if (isWebhookRequest(req)) {
      next();
      return;
    }
    urlencodedParser(req, res, next);
  });

  // 3. CORS.
  app.use(cors(corsOptions));

  // 4. Request logging (method, path, status, duration, userId).
  app.use((req: Request, res: Response, next: NextFunction): void => {
    const start = Date.now();
    res.on("finish", () => {
      logger.info(
        {
          method: req.method,
          path: req.originalUrl,
          status: res.statusCode,
          userId: req.user?.id,
          durationMs: Date.now() - start,
        },
        "request completed",
      );
    });
    next();
  });

  // 5. Health check — reports database, Redis, and WebSocket server status.
  // Returns 200 when everything is up, 503 when any dependency is down so
  // platform health probes (Render) can react appropriately.
  app.get("/health", (_req: Request, res: Response): void => {
    void buildHealthReport().then((report) => {
      const { httpStatus, ...body } = report;
      res.status(httpStatus).json(body);
    });
  });

  // 6. API routes.
  app.use("/api", apiRouter);

  // 7. 404 handler.
  app.use((_req: Request, res: Response): void => {
    const body: ApiResponse<never> = {
      success: false,
      error: { code: "NOT_FOUND", message: "Route not found" },
    };
    res.status(404).json(body);
  });

  // 8. Centralized error handler (must be last).
  app.use(errorHandler);

  return app;
}

export const app: Express = buildApp();

async function disconnectResources(): Promise<void> {
  try {
    await prisma.$disconnect();
    logger.info("Prisma disconnected");
  } catch (error) {
    logger.error({ error }, "Failed to disconnect Prisma");
  }

  try {
    await redis.quit();
    logger.info("Redis disconnected");
  } catch (error) {
    logger.error({ error }, "Failed to disconnect Redis");
  }
}

function registerShutdownHandlers(server: Server, wss: WebSocketServer): void {
  let shuttingDown = false;

  const shutdown = (signal: string): void => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logger.info({ signal }, "Graceful shutdown initiated");

    // Notify connected clients before tearing down the socket server.
    for (const [, conn] of connectionManager.getConnectionEntries()) {
      sendMessage(conn.ws, {
        type: "ERROR",
        payload: { code: "SERVER_SHUTDOWN", message: "Server is shutting down" },
      });
    }

    // Close WebSocket server (terminates all sockets via its close handler).
    wss.close();

    // Stop accepting new HTTP connections and wait for in-flight ones.
    server.close(() => {
      void disconnectResources().then(() => {
        logger.info("Shutdown complete");
        process.exit(0);
      });
    });

    // Safety net: force exit if graceful shutdown stalls.
    setTimeout(() => {
      logger.error("Forced shutdown after timeout");
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

// Creates the HTTP + WebSocket server, wires graceful shutdown, and begins
// listening. Resolves with the HTTP server once it is accepting connections.
export function startServer(): Promise<Server> {
  const server = createServer(app);
  const wss = setupWebSocketServer(server);
  registerShutdownHandlers(server, wss);

  return new Promise<Server>((resolve, reject) => {
    const onError = (error: Error): void => {
      reject(error);
    };
    server.once("error", onError);
    server.listen(env.PORT, () => {
      server.removeListener("error", onError);
      resolve(server);
    });
  });
}
