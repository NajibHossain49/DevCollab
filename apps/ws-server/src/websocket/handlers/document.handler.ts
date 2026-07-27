import { connectionManager, sendMessage, type Connection } from "../connection.js";
import { documentManager } from "../managers/document-manager.js";
import { roomManager } from "../managers/room-manager.js";

const PERSIST_THROTTLE_MS = 10_000;

// DOC_UPDATE: apply the Yjs update, relay it to peers, and persist periodically.
export function handleDocUpdate(
  connId: string,
  conn: Connection,
  payload: { roomId: string; update: number[] },
): void {
  const update = Uint8Array.from(payload.update);
  documentManager.applyUpdate(payload.roomId, update, conn.userId);
  roomManager.touch(payload.roomId);

  connectionManager.broadcastToRoom(
    payload.roomId,
    { type: "DOC_SYNC", payload: { roomId: payload.roomId, update: payload.update } },
    connId,
  );

  documentManager.persistIfStale(payload.roomId, PERSIST_THROTTLE_MS);
}

// REQUEST_DOC_SYNC: send the full current document state to the requester.
export function handleRequestDocSync(_connId: string, conn: Connection, roomId: string): void {
  const state = documentManager.getDocumentState(roomId);
  sendMessage(conn.ws, { type: "DOC_SYNC", payload: { roomId, update: Array.from(state) } });
}
