import { createServer, type Server } from "node:http";

import cors from "cors";
import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import type { WebSocketServer } from "ws";

import { prisma } from "./config/database.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { redis } from "./config/redis.js";
import { errorHandler } from "./middleware/error-handler.js";
import apiRouter from "./routes/index.js";
import type { ApiResponse } from "./types/index.js";
import { connectionManager, sendMessage } from "./websocket/connection.js";
import { setupWebSocketServer } from "./websocket/server.js";

// How long to wait for in-flight work before forcing exit during shutdown.
const SHUTDOWN_TIMEOUT_MS = 10_000;

function buildApp(): Express {
  const app = express();

  // 1 & 2. Body / form parsers.
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // 3. CORS.
  app.use(
    cors({
      origin: env.NEXTAUTH_URL,
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  );

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

  // 5. Health check.
  app.get("/health", (_req: Request, res: Response): void => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
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
