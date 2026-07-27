import type { ChatMessage } from "@prisma/client";
import type * as Y from "yjs";

import { logger } from "../../config/logger.js";
import { NotFoundError } from "../../utils/errors.js";
import type { AwarenessState } from "../types.js";
import { awarenessManager } from "./awareness-manager.js";
import { documentManager } from "./document-manager.js";

export interface RoomState {
  document: Y.Doc;
  awareness: Map<string, AwarenessState>;
  chatHistory: ChatMessage[];
  createdAt: Date;
  lastActivity: Date;
}

export class RoomManager {
  private readonly _rooms = new Map<string, RoomState>();

  createRoomState(roomId: string): void {
    if (this._rooms.has(roomId)) {
      return;
    }
    // Share the single source of truth for the doc and awareness state.
    const document = documentManager.getOrCreateDocument(roomId);
    const awareness = awarenessManager.getRoomStates(roomId);
    const now = new Date();
    this._rooms.set(roomId, {
      document,
      awareness,
      chatHistory: [],
      createdAt: now,
      lastActivity: now,
    });
    logger.info({ roomId }, "Room state created");
  }

  deleteRoomState(roomId: string): void {
    if (this._rooms.delete(roomId)) {
      logger.info({ roomId }, "Room state deleted");
    }
  }

  getRoomState(roomId: string): RoomState {
    const state = this._rooms.get(roomId);
    if (!state) {
      throw new NotFoundError("Room state");
    }
    return state;
  }

  isRoomActive(roomId: string): boolean {
    return this._rooms.has(roomId);
  }

  touch(roomId: string): void {
    const state = this._rooms.get(roomId);
    if (state) {
      state.lastActivity = new Date();
    }
  }
}

export const roomManager = new RoomManager();
