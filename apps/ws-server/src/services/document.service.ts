import { Prisma, type Document } from "@prisma/client";

import { prisma } from "../config/database.js";
import { logger } from "../config/logger.js";
import { AppError, DatabaseError, NotFoundError } from "../utils/errors.js";

// Returns the latest persisted Yjs state for a room, or null if none saved yet.
export async function getDocumentState(roomId: string): Promise<Uint8Array | null> {
  try {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      select: { yjsState: true },
    });
    if (!room) {
      throw new NotFoundError("Room");
    }
    return room.yjsState ?? null;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error({ error, roomId }, "Failed to get document state");
    throw new DatabaseError("Failed to get document state");
  }
}

// Persists the latest Yjs state on the room and appends a version-history entry.
export async function saveDocumentState(roomId: string, state: Uint8Array): Promise<void> {
  const buffer = Buffer.from(state);

  try {
    await prisma.$transaction(async (tx) => {
      const room = await tx.room.findUnique({ where: { id: roomId }, select: { id: true } });
      if (!room) {
        throw new NotFoundError("Room");
      }

      const latest = await tx.document.findFirst({
        where: { roomId },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      const nextVersion = (latest?.version ?? 0) + 1;

      await tx.document.create({ data: { roomId, yjsState: buffer, version: nextVersion } });
      await tx.room.update({ where: { id: roomId }, data: { yjsState: buffer } });

      logger.info({ roomId, version: nextVersion, size: buffer.length }, "Document state saved");
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error({ error, roomId }, "Failed to save document state");
    throw new DatabaseError("Failed to save document state");
  }
}

// Stores a human-readable snapshot alongside an (empty) binary state for debugging.
export async function createDocumentSnapshot(
  roomId: string,
  version: number,
  text: string,
): Promise<Document> {
  try {
    const snapshot = await prisma.document.create({
      data: { roomId, version, yjsState: Buffer.from([]), snapshot: text },
    });
    logger.info({ roomId, version }, "Document snapshot created");
    return snapshot;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        throw new AppError("CONFLICT", `Snapshot for version ${version} already exists`, 409);
      }
      if (error.code === "P2003") {
        throw new NotFoundError("Room");
      }
    }
    logger.error({ error, roomId, version }, "Failed to create document snapshot");
    throw new DatabaseError("Failed to create document snapshot");
  }
}
