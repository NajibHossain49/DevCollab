import { connectionManager, type Connection } from "../connection.js";
import { awarenessManager } from "../managers/awareness-manager.js";
import type { Position, Selection } from "../types.js";

// CURSOR_MOVE: update the user's cursor and relay it to peers.
export function handleCursorMove(
  connId: string,
  conn: Connection,
  payload: { roomId: string; position: Position; selection?: Selection },
): void {
  awarenessManager.ensureUser(payload.roomId, conn.userId, conn.userName, conn.color);
  awarenessManager.updateCursor(payload.roomId, conn.userId, payload.position, payload.selection);

  connectionManager.broadcastToRoom(
    payload.roomId,
    {
      type: "CURSOR_UPDATE",
      payload: {
        userId: conn.userId,
        userName: conn.userName,
        color: conn.color,
        position: payload.position,
        selection: payload.selection,
      },
    },
    connId,
  );
}

// USER_TYPING: update typing status and broadcast full awareness state.
export function handleUserTyping(
  _connId: string,
  conn: Connection,
  payload: { roomId: string; isTyping: boolean },
): void {
  awarenessManager.ensureUser(payload.roomId, conn.userId, conn.userName, conn.color);
  awarenessManager.updateTyping(payload.roomId, conn.userId, payload.isTyping);
  awarenessManager.broadcastAwareness(payload.roomId);
}
