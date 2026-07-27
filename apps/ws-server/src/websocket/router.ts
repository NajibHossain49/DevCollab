import { logger } from "../config/logger.js";
import { sendMessage, type Connection } from "./connection.js";
import { handleCursorMove, handleUserTyping } from "./handlers/awareness.handler.js";
import { handleChatMessage } from "./handlers/chat.handler.js";
import { handleDocUpdate, handleRequestDocSync } from "./handlers/document.handler.js";
import { handleJoinRoom, handleLeaveRoom } from "./handlers/room.handler.js";
import { clientMessageSchema } from "./types.js";

// Parses, validates, and dispatches an incoming WebSocket message.
export async function routeMessage(connId: string, conn: Connection, raw: string): Promise<void> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    sendMessage(conn.ws, { type: "ERROR", payload: { code: "BAD_JSON", message: "Invalid JSON payload" } });
    return;
  }

  const result = clientMessageSchema.safeParse(parsed);
  if (!result.success) {
    sendMessage(conn.ws, {
      type: "ERROR",
      payload: { code: "BAD_MESSAGE", message: "Unknown or malformed message" },
    });
    return;
  }

  const message = result.data;
  conn.lastActivity = new Date();
  logger.debug({ connId, type: message.type, userId: conn.userId }, "ws message");

  try {
    switch (message.type) {
      case "JOIN_ROOM":
        await handleJoinRoom(connId, conn, message.payload.roomId);
        break;
      case "LEAVE_ROOM":
        await handleLeaveRoom(connId, conn, message.payload.roomId);
        break;
      case "DOC_UPDATE":
        handleDocUpdate(connId, conn, message.payload);
        break;
      case "REQUEST_DOC_SYNC":
        handleRequestDocSync(connId, conn, message.payload.roomId);
        break;
      case "CURSOR_MOVE":
        handleCursorMove(connId, conn, message.payload);
        break;
      case "USER_TYPING":
        handleUserTyping(connId, conn, message.payload);
        break;
      case "CHAT_MESSAGE":
        await handleChatMessage(connId, conn, message.payload);
        break;
      default:
        sendMessage(conn.ws, {
          type: "ERROR",
          payload: { code: "UNKNOWN_TYPE", message: "Unsupported message type" },
        });
    }
  } catch (error) {
    logger.error({ error, connId, type: message.type }, "ws handler failed");
    sendMessage(conn.ws, {
      type: "ERROR",
      payload: { code: "INTERNAL_ERROR", message: "Failed to process message" },
    });
  }
}
