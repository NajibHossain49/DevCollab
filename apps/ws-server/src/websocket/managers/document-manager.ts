import * as Y from "yjs";

import { logger } from "../../config/logger.js";
import { saveDocumentState } from "../../services/document.service.js";

export interface RoomDocument {
  doc: Y.Doc;
  yText: Y.Text;
  updateHandler: (update: Uint8Array, origin: unknown) => void;
  lastPersisted: Date;
}

export class DocumentManager {
  private readonly _documents = new Map<string, RoomDocument>();

  getOrCreateDocument(roomId: string): Y.Doc {
    const existing = this._documents.get(roomId);
    if (existing) {
      return existing.doc;
    }

    const doc = new Y.Doc();
    const yText = doc.getText("code");
    const updateHandler = (_update: Uint8Array, _origin: unknown): void => {
      // Change hook — persistence is driven by persistIfStale / cleanup.
    };
    doc.on("update", updateHandler);

    this._documents.set(roomId, { doc, yText, updateHandler, lastPersisted: new Date() });
    logger.debug({ roomId }, "Yjs document created");
    return doc;
  }

  applyUpdate(roomId: string, update: Uint8Array, origin?: string): void {
    const doc = this.getOrCreateDocument(roomId);
    Y.applyUpdate(doc, update, origin);
  }

  getDocumentState(roomId: string): Uint8Array {
    const doc = this.getOrCreateDocument(roomId);
    return Y.encodeStateAsUpdate(doc);
  }

  getDocumentText(roomId: string): string {
    this.getOrCreateDocument(roomId);
    return this._documents.get(roomId)?.yText.toString() ?? "";
  }

  // Returns the current text only if the doc is already loaded in memory,
  // without creating an empty one (which would risk overwriting persisted state).
  getExistingDocumentText(roomId: string): string | null {
    const entry = this._documents.get(roomId);
    return entry ? entry.yText.toString() : null;
  }

  hasDocument(roomId: string): boolean {
    return this._documents.has(roomId);
  }

  // Replaces the shared "code" text with new content and returns the full,
  // encoded Yjs state so callers can broadcast a DOC_SYNC to connected clients.
  replaceDocumentText(roomId: string, content: string): Uint8Array {
    const doc = this.getOrCreateDocument(roomId);
    const entry = this._documents.get(roomId);
    const yText = entry?.yText ?? doc.getText("code");
    doc.transact(() => {
      yText.delete(0, yText.length);
      yText.insert(0, content);
    });
    return Y.encodeStateAsUpdate(doc);
  }

  async persistDocument(roomId: string): Promise<void> {
    const state = this.getDocumentState(roomId);
    await saveDocumentState(roomId, state);
    const entry = this._documents.get(roomId);
    if (entry) {
      entry.lastPersisted = new Date();
    }
    logger.info({ roomId, size: state.length }, "Document persisted");
  }

  // Persists a room's document if it hasn't been saved within maxAgeMs.
  persistIfStale(roomId: string, maxAgeMs: number): void {
    const entry = this._documents.get(roomId);
    if (!entry) {
      return;
    }
    if (Date.now() - entry.lastPersisted.getTime() < maxAgeMs) {
      return;
    }
    void this.persistDocument(roomId).catch((error: unknown) => {
      logger.error({ error, roomId }, "Failed to persist document");
    });
  }

  cleanupInactiveDocuments(maxAgeMs: number): void {
    const now = Date.now();
    for (const [roomId, entry] of this._documents) {
      if (now - entry.lastPersisted.getTime() <= maxAgeMs) {
        continue;
      }
      void this.persistDocument(roomId).catch((error: unknown) => {
        logger.error({ error, roomId }, "Failed to persist during cleanup");
      });
      entry.doc.off("update", entry.updateHandler);
      entry.doc.destroy();
      this._documents.delete(roomId);
      logger.info({ roomId }, "Cleaned up inactive document");
    }
  }
}

export const documentManager = new DocumentManager();
