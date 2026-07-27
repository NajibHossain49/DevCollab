import { WebSocket } from "ws";

import { logger } from "../config/logger.js";
import type { WebSocketMessage } from "./types.js";

export interface Connection {
  ws: WebSocket;
  userId: string;
  userName: string;
  userAvatar?: string;
  roomId?: string;
  color: string;
  isAlive: boolean;
  lastActivity: Date;
}

// Sends a JSON-encoded message to a single socket if it is still open.
export function sendMessage(ws: WebSocket, message: WebSocketMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

export class ConnectionManager {
  private readonly _connections = new Map<string, Connection>();
  private readonly _roomConnections = new Map<string, Set<string>>();

  addConnection(connId: string, conn: Connection): void {
    this._connections.set(connId, conn);
  }

  removeConnection(connId: string): void {
    this.leaveRoom(connId);
    this._connections.delete(connId);
  }

  joinRoom(connId: string, roomId: string): void {
    const conn = this._connections.get(connId);
    if (!conn) {
      return;
    }

    // Leave any previous room first.
    this.leaveRoom(connId);

    conn.roomId = roomId;
    let members = this._roomConnections.get(roomId);
    if (!members) {
      members = new Set<string>();
      this._roomConnections.set(roomId, members);
    }
    members.add(connId);
  }

  leaveRoom(connId: string): void {
    const conn = this._connections.get(connId);
    if (!conn?.roomId) {
      return;
    }

    const members = this._roomConnections.get(conn.roomId);
    if (members) {
      members.delete(connId);
      if (members.size === 0) {
        this._roomConnections.delete(conn.roomId);
      }
    }
    conn.roomId = undefined;
  }

  broadcastToRoom(roomId: string, message: WebSocketMessage, excludeConnId?: string): void {
    const members = this._roomConnections.get(roomId);
    if (!members) {
      return;
    }

    let delivered = 0;
    for (const connId of members) {
      if (connId === excludeConnId) {
        continue;
      }
      const conn = this._connections.get(connId);
      if (conn) {
        sendMessage(conn.ws, message);
        delivered += 1;
      }
    }
    logger.debug({ roomId, type: message.type, delivered }, "broadcast");
  }

  getRoomMembers(roomId: string): Connection[] {
    const members = this._roomConnections.get(roomId);
    if (!members) {
      return [];
    }
    const result: Connection[] = [];
    for (const connId of members) {
      const conn = this._connections.get(connId);
      if (conn) {
        result.push(conn);
      }
    }
    return result;
  }

  getConnection(connId: string): Connection | undefined {
    return this._connections.get(connId);
  }

  getConnectionEntries(): Array<[string, Connection]> {
    return [...this._connections.entries()];
  }

  getConnectionCount(): number {
    return this._connections.size;
  }

  getRoomConnectionCount(roomId: string): number {
    return this._roomConnections.get(roomId)?.size ?? 0;
  }
}

export const connectionManager = new ConnectionManager();
