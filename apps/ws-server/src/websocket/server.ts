import { randomUUID } from "node:crypto";
import type { IncomingMessage, Server } from "node:http";

import type { User } from "@prisma/client";
import jwt from "jsonwebtoken";
import { WebSocket, WebSocketServer } from "ws";

import { prisma } from "../config/database.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { connectionManager, sendMessage, type Connection } from "./connection.js";
import { awarenessManager } from "./managers/awareness-manager.js";
import { documentManager } from "./managers/document-manager.js";
import { roomManager } from "./managers/room-manager.js";
import { routeMessage } from "./router.js";
import { WS_HEARTBEAT_INTERVAL, WS_HEARTBEAT_TIMEOUT, pickColor } from "./types.js";

async function authenticate(token: string): Promise<User | null> {
  try {
    const payload = jwt.verify(token, env.NEXTAUTH_SECRET);
    if (typeof payload === "string") {
      return null;
    }
    const record = payload as Record<string, unknown>;
    const candidate = payload.sub ?? record["userId"] ?? record["id"];
    if (typeof candidate !== "string") {
      return null;
    }
    return await prisma.user.findUnique({ where: { id: candidate } });
  } catch {
    return null;
  }
}

async function cleanupConnection(connId: string, conn: Connection): Promise<void> {
  const roomId = conn.roomId;
  connectionManager.removeConnection(connId);

  if (roomId) {
    awarenessManager.removeUser(roomId, conn.userId);
    connectionManager.broadcastToRoom(roomId, {
      type: "USER_LEFT",
      payload: { userId: conn.userId, timestamp: new Date().toISOString() },
    });

    if (connectionManager.getRoomConnectionCount(roomId) === 0) {
      await documentManager.persistDocument(roomId).catch((error: unknown) => {
        logger.error({ error, roomId }, "Failed to persist on disconnect");
      });
      roomManager.deleteRoomState(roomId);
    }
  }

  logger.info({ connId, userId: conn.userId }, "WebSocket disconnected");
}

async function handleConnection(ws: WebSocket, req: IncomingMessage): Promise<void> {
  const url = new URL(req.url ?? "/", "http://localhost");
  const token = url.searchParams.get("token");

  if (!token) {
    sendMessage(ws, { type: "ERROR", payload: { code: "UNAUTHORIZED", message: "Missing token" } });
    ws.close(1008, "Unauthorized");
    return;
  }

  const user = await authenticate(token);
  if (!user) {
    sendMessage(ws, { type: "ERROR", payload: { code: "UNAUTHORIZED", message: "Invalid token" } });
    ws.close(1008, "Unauthorized");
    return;
  }

  const connId = randomUUID();
  const conn: Connection = {
    ws,
    userId: user.id,
    userName: user.name,
    userAvatar: user.avatar ?? undefined,
    color: pickColor(),
    isAlive: true,
    lastActivity: new Date(),
  };
  connectionManager.addConnection(connId, conn);
  logger.info({ connId, userId: user.id }, "WebSocket connected");

  ws.on("pong", () => {
    conn.isAlive = true;
  });

  ws.on("message", (data) => {
    void routeMessage(connId, conn, data.toString());
  });

  ws.on("close", () => {
    void cleanupConnection(connId, conn);
  });

  ws.on("error", (error) => {
    logger.error({ error, connId }, "WebSocket connection error");
  });
}

// Attaches a WebSocket server (path /ws) to an existing HTTP server.
export function setupWebSocketServer(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    void handleConnection(ws, req);
  });

  // Heartbeat: ping everyone every interval; terminate sockets that miss the
  // pong within the timeout window.
  const heartbeat = setInterval(() => {
    for (const [, conn] of connectionManager.getConnectionEntries()) {
      conn.isAlive = false;
      try {
        conn.ws.ping();
      } catch (error) {
        logger.warn({ error }, "Failed to ping connection");
      }
      setTimeout(() => {
        if (!conn.isAlive && conn.ws.readyState === WebSocket.OPEN) {
          conn.ws.terminate();
        }
      }, WS_HEARTBEAT_TIMEOUT);
    }
  }, WS_HEARTBEAT_INTERVAL);

  wss.on("close", () => {
    clearInterval(heartbeat);
    for (const [, conn] of connectionManager.getConnectionEntries()) {
      conn.ws.terminate();
    }
    logger.info("WebSocket server closed");
  });

  logger.info("WebSocket server initialized on /ws");
  return wss;
}
