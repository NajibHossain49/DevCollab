import { randomUUID } from "node:crypto";
import type { IncomingMessage, Server } from "node:http";

import type { User } from "@prisma/client";
import jwt from "jsonwebtoken";
import { WebSocket, WebSocketServer } from "ws";

import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { resolveUserFromPayload } from "../middleware/auth.js";
import { connectionManager, sendMessage, type Connection } from "./connection.js";
import { awarenessManager } from "./managers/awareness-manager.js";
import { documentManager } from "./managers/document-manager.js";
import { roomManager } from "./managers/room-manager.js";
import { routeMessage } from "./router.js";
import { WS_HEARTBEAT_INTERVAL, WS_HEARTBEAT_TIMEOUT, pickColor } from "./types.js";

// Tracks connections awaiting a pong after the last ping. A single timer per
// connection is stored here (instead of recreating closures every interval) so
// it can be cleared on pong or cleanup.
const pendingPongs = new Map<string, NodeJS.Timeout>();

function clearPendingPong(connId: string): void {
  const timeout = pendingPongs.get(connId);
  if (timeout) {
    clearTimeout(timeout);
    pendingPongs.delete(connId);
  }
}

async function authenticate(token: string): Promise<User | null> {
  try {
    const payload = jwt.verify(token, env.NEXTAUTH_SECRET);
    if (typeof payload === "string") {
      return null;
    }
    return await resolveUserFromPayload(payload);
  } catch {
    return null;
  }
}

async function cleanupConnection(connId: string, conn: Connection): Promise<void> {
  clearPendingPong(connId);
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
    clearPendingPong(connId);
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
  // pong within the timeout window. A pending pong still outstanding from the
  // previous round means the client is unresponsive, so skip re-pinging it.
  const heartbeat = setInterval(() => {
    for (const [connId, conn] of connectionManager.getConnectionEntries()) {
      if (pendingPongs.has(connId)) {
        continue;
      }

      conn.isAlive = false;
      try {
        conn.ws.ping();
      } catch (error) {
        logger.warn({ error, connId }, "Failed to ping connection");
        continue;
      }

      const timeout = setTimeout(() => {
        pendingPongs.delete(connId);
        if (conn.ws.readyState === WebSocket.OPEN) {
          conn.ws.terminate();
        }
      }, WS_HEARTBEAT_TIMEOUT);
      pendingPongs.set(connId, timeout);
    }
  }, WS_HEARTBEAT_INTERVAL);

  wss.on("close", () => {
    clearInterval(heartbeat);
    for (const timeout of pendingPongs.values()) {
      clearTimeout(timeout);
    }
    pendingPongs.clear();
    for (const [, conn] of connectionManager.getConnectionEntries()) {
      conn.ws.terminate();
    }
    logger.info("WebSocket server closed");
  });

  logger.info("WebSocket server initialized on /ws");
  return wss;
}
