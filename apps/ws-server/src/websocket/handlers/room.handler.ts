import { prisma } from "../../config/database.js";
import { logger } from "../../config/logger.js";
import { connectionManager, sendMessage, type Connection } from "../connection.js";
import { awarenessManager } from "../managers/awareness-manager.js";
import { documentManager } from "../managers/document-manager.js";
import { roomManager } from "../managers/room-manager.js";

// JOIN_ROOM: validate access, register the connection, and bootstrap the client.
export async function handleJoinRoom(
  connId: string,
  conn: Connection,
  roomId: string,
): Promise<void> {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: { id: true, isPublic: true },
  });
  if (!room) {
    sendMessage(conn.ws, { type: "ERROR", payload: { code: "NOT_FOUND", message: "Room not found" } });
    return;
  }

  const membership = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId, userId: conn.userId } },
  });
  if (!membership && !room.isPublic) {
    sendMessage(conn.ws, {
      type: "ERROR",
      payload: { code: "FORBIDDEN", message: "You do not have access to this room" },
    });
    return;
  }

  connectionManager.joinRoom(connId, roomId);
  roomManager.createRoomState(roomId);
  roomManager.touch(roomId);
  awarenessManager.ensureUser(roomId, conn.userId, conn.userName, conn.color);

  // Notify existing members.
  connectionManager.broadcastToRoom(
    roomId,
    {
      type: "USER_JOINED",
      payload: {
        user: { id: conn.userId, name: conn.userName, avatar: conn.userAvatar, color: conn.color },
        timestamp: new Date().toISOString(),
      },
    },
    connId,
  );

  // Bootstrap the joining client with document + awareness state.
  const state = documentManager.getDocumentState(roomId);
  sendMessage(conn.ws, { type: "DOC_SYNC", payload: { roomId, update: Array.from(state) } });
  sendMessage(conn.ws, {
    type: "AWARENESS_UPDATE",
    payload: { roomId, users: awarenessManager.buildAwarenessUsers(roomId) },
  });

  logger.info({ connId, roomId, userId: conn.userId }, "User joined room");
}

// LEAVE_ROOM: unregister the connection and clean up empty rooms.
export async function handleLeaveRoom(
  connId: string,
  conn: Connection,
  roomId: string,
): Promise<void> {
  awarenessManager.removeUser(roomId, conn.userId);
  connectionManager.leaveRoom(connId);

  connectionManager.broadcastToRoom(roomId, {
    type: "USER_LEFT",
    payload: { userId: conn.userId, timestamp: new Date().toISOString() },
  });

  if (connectionManager.getRoomConnectionCount(roomId) === 0) {
    await documentManager.persistDocument(roomId).catch((error: unknown) => {
      logger.error({ error, roomId }, "Failed to persist on room empty");
    });
    roomManager.deleteRoomState(roomId);
  }

  logger.info({ connId, roomId, userId: conn.userId }, "User left room");
}
