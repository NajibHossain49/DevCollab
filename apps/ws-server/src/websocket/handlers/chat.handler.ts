import { prisma } from "../../config/database.js";
import { logger } from "../../config/logger.js";
import { connectionManager, sendMessage, type Connection } from "../connection.js";
import { roomManager } from "../managers/room-manager.js";

// CHAT_MESSAGE: persist the message and broadcast it to the room.
export async function handleChatMessage(
  _connId: string,
  conn: Connection,
  payload: { roomId: string; content: string },
): Promise<void> {
  try {
    const saved = await prisma.chatMessage.create({
      data: { roomId: payload.roomId, userId: conn.userId, content: payload.content },
    });

    if (roomManager.isRoomActive(payload.roomId)) {
      roomManager.getRoomState(payload.roomId).chatHistory.push(saved);
      roomManager.touch(payload.roomId);
    }

    connectionManager.broadcastToRoom(payload.roomId, {
      type: "CHAT_MESSAGE_BROADCAST",
      payload: {
        id: saved.id,
        userId: conn.userId,
        userName: conn.userName,
        avatar: conn.userAvatar,
        content: saved.content,
        createdAt: saved.createdAt.toISOString(),
      },
    });
  } catch (error) {
    logger.error({ error, roomId: payload.roomId, userId: conn.userId }, "Failed to save chat message");
    sendMessage(conn.ws, {
      type: "ERROR",
      payload: { code: "CHAT_FAILED", message: "Failed to send chat message" },
    });
  }
}
