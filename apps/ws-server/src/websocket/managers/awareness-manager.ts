import { logger } from "../../config/logger.js";
import { connectionManager } from "../connection.js";
import type { AwarenessState, AwarenessUser, Position, Selection } from "../types.js";

export class AwarenessManager {
  private readonly _states = new Map<string, Map<string, AwarenessState>>();

  // Returns (creating if necessary) the per-user state map for a room.
  getRoomStates(roomId: string): Map<string, AwarenessState> {
    let room = this._states.get(roomId);
    if (!room) {
      room = new Map<string, AwarenessState>();
      this._states.set(roomId, room);
    }
    return room;
  }

  // Ensures a baseline awareness entry exists for a user in a room.
  ensureUser(roomId: string, userId: string, name: string, color: string): void {
    const room = this.getRoomStates(roomId);
    if (!room.has(userId)) {
      room.set(userId, { userId, name, color, isTyping: false, lastSeen: new Date() });
    }
  }

  updateCursor(roomId: string, userId: string, position: Position, selection?: Selection): void {
    const state = this.getRoomStates(roomId).get(userId);
    if (!state) {
      return;
    }
    state.cursor = position;
    state.selection = selection;
    state.lastSeen = new Date();
  }

  updateTyping(roomId: string, userId: string, isTyping: boolean): void {
    const state = this.getRoomStates(roomId).get(userId);
    if (!state) {
      return;
    }
    state.isTyping = isTyping;
    state.lastSeen = new Date();
  }

  getRoomAwareness(roomId: string): AwarenessState[] {
    const room = this._states.get(roomId);
    return room ? [...room.values()] : [];
  }

  // Serializes room awareness for an AWARENESS_UPDATE payload.
  buildAwarenessUsers(roomId: string): AwarenessUser[] {
    return this.getRoomAwareness(roomId).map((state) => ({
      userId: state.userId,
      name: state.name,
      color: state.color,
      cursor: state.cursor,
      isTyping: state.isTyping,
      lastSeen: state.lastSeen.toISOString(),
    }));
  }

  removeUser(roomId: string, userId: string): void {
    const room = this._states.get(roomId);
    if (!room) {
      return;
    }
    room.delete(userId);
    if (room.size === 0) {
      this._states.delete(roomId);
    }
  }

  broadcastAwareness(roomId: string): void {
    connectionManager.broadcastToRoom(roomId, {
      type: "AWARENESS_UPDATE",
      payload: { roomId, users: this.buildAwarenessUsers(roomId) },
    });
    logger.debug({ roomId }, "Awareness broadcast");
  }
}

export const awarenessManager = new AwarenessManager();
