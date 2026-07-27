import { MemberRole, Prisma, type Room, type RoomMember } from "@prisma/client";

import { prisma } from "../config/database.js";
import { logger } from "../config/logger.js";
import {
  AppError,
  DatabaseError,
  ForbiddenError,
  NotFoundError,
} from "../utils/errors.js";
import type { CreateRoomInput, UpdateRoomInput } from "../utils/validators.js";

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return base.length > 0 ? base : "room";
}

async function generateUniqueSlug(name: string): Promise<string> {
  const base = slugify(name);
  let slug = base;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const existing = await prisma.room.findUnique({ where: { slug }, select: { id: true } });
    if (!existing) {
      return slug;
    }
    const suffix = Math.random().toString(36).slice(2, 6);
    slug = `${base}-${suffix}`;
  }

  return `${base}-${Date.now().toString(36)}`;
}

export async function createRoom(ownerId: string, data: CreateRoomInput): Promise<Room> {
  try {
    const slug = await generateUniqueSlug(data.name);

    const room = await prisma.$transaction(async (tx) => {
      const created = await tx.room.create({
        data: {
          name: data.name,
          slug,
          description: data.description ?? null,
          language: data.language,
          isPublic: data.isPublic,
          ownerId,
        },
      });

      await tx.roomMember.create({
        data: { roomId: created.id, userId: ownerId, role: MemberRole.OWNER },
      });

      return created;
    });

    logger.info({ roomId: room.id, slug: room.slug, ownerId }, "Room created");
    return room;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error({ error, ownerId }, "Failed to create room");
    throw new DatabaseError("Failed to create room");
  }
}

export async function getRoomBySlug(slug: string): Promise<Room> {
  try {
    const room = await prisma.room.findUnique({
      where: { slug },
      include: {
        owner: true,
        members: { include: { user: true } },
      },
    });

    if (!room) {
      throw new NotFoundError("Room");
    }

    return room;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error({ error, slug }, "Failed to get room by slug");
    throw new DatabaseError("Failed to retrieve room");
  }
}

export async function getUserRooms(
  userId: string,
  page: number,
  limit: number,
): Promise<{ rooms: Room[]; total: number }> {
  const skip = Math.max(0, (page - 1) * limit);
  const where: Prisma.RoomWhereInput = {
    OR: [{ ownerId: userId }, { members: { some: { userId } } }],
  };

  try {
    const [rooms, total] = await prisma.$transaction([
      prisma.room.findMany({ where, skip, take: limit, orderBy: { updatedAt: "desc" } }),
      prisma.room.count({ where }),
    ]);

    logger.info({ userId, page, limit, total }, "Listed user rooms");
    return { rooms, total };
  } catch (error) {
    logger.error({ error, userId }, "Failed to list user rooms");
    throw new DatabaseError("Failed to list rooms");
  }
}

export async function updateRoom(
  slug: string,
  userId: string,
  data: UpdateRoomInput,
): Promise<Room> {
  try {
    const room = await prisma.room.findUnique({ where: { slug } });
    if (!room) {
      throw new NotFoundError("Room");
    }
    if (room.ownerId !== userId) {
      throw new ForbiddenError("Only the owner can update this room");
    }

    const updated = await prisma.room.update({ where: { slug }, data });
    logger.info({ roomId: updated.id, slug, userId }, "Room updated");
    return updated;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error({ error, slug, userId }, "Failed to update room");
    throw new DatabaseError("Failed to update room");
  }
}

export async function deleteRoom(slug: string, userId: string): Promise<void> {
  try {
    const room = await prisma.room.findUnique({ where: { slug } });
    if (!room) {
      throw new NotFoundError("Room");
    }
    if (room.ownerId !== userId) {
      throw new ForbiddenError("Only the owner can delete this room");
    }

    await prisma.room.delete({ where: { slug } });
    logger.info({ roomId: room.id, slug, userId }, "Room deleted");
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error({ error, slug, userId }, "Failed to delete room");
    throw new DatabaseError("Failed to delete room");
  }
}

export async function joinRoom(roomId: string, userId: string): Promise<RoomMember> {
  try {
    const room = await prisma.room.findUnique({ where: { id: roomId }, select: { id: true } });
    if (!room) {
      throw new NotFoundError("Room");
    }

    const existing = await prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });
    if (existing) {
      throw new ForbiddenError("Already a member of this room");
    }

    const membership = await prisma.roomMember.create({
      data: { roomId, userId, role: MemberRole.EDITOR },
    });
    logger.info({ roomId, userId }, "User joined room");
    return membership;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error({ error, roomId, userId }, "Failed to join room");
    throw new DatabaseError("Failed to join room");
  }
}

export async function leaveRoom(roomId: string, userId: string): Promise<void> {
  try {
    const membership = await prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });
    if (!membership) {
      throw new NotFoundError("Membership");
    }
    if (membership.role === MemberRole.OWNER) {
      throw new ForbiddenError("Owner cannot leave; transfer ownership or delete the room");
    }

    await prisma.roomMember.delete({ where: { roomId_userId: { roomId, userId } } });
    logger.info({ roomId, userId }, "User left room");
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error({ error, roomId, userId }, "Failed to leave room");
    throw new DatabaseError("Failed to leave room");
  }
}

export async function updateMemberRole(
  roomId: string,
  ownerId: string,
  targetUserId: string,
  role: MemberRole,
): Promise<RoomMember> {
  try {
    const room = await prisma.room.findUnique({ where: { id: roomId }, select: { ownerId: true } });
    if (!room) {
      throw new NotFoundError("Room");
    }
    if (room.ownerId !== ownerId) {
      throw new ForbiddenError("Only the owner can change member roles");
    }
    if (targetUserId === room.ownerId) {
      throw new ForbiddenError("The owner's role cannot be changed");
    }

    const target = await prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId: targetUserId } },
    });
    if (!target) {
      throw new NotFoundError("Membership");
    }

    const updated = await prisma.roomMember.update({
      where: { roomId_userId: { roomId, userId: targetUserId } },
      data: { role },
    });
    logger.info({ roomId, ownerId, targetUserId, role }, "Member role updated");
    return updated;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error({ error, roomId, targetUserId }, "Failed to update member role");
    throw new DatabaseError("Failed to update member role");
  }
}

export async function removeMember(
  roomId: string,
  ownerId: string,
  targetUserId: string,
): Promise<void> {
  try {
    const room = await prisma.room.findUnique({ where: { id: roomId }, select: { ownerId: true } });
    if (!room) {
      throw new NotFoundError("Room");
    }
    if (room.ownerId !== ownerId) {
      throw new ForbiddenError("Only the owner can remove members");
    }
    if (targetUserId === room.ownerId) {
      throw new ForbiddenError("The owner cannot be removed");
    }

    await prisma.roomMember.delete({
      where: { roomId_userId: { roomId, userId: targetUserId } },
    });
    logger.info({ roomId, ownerId, targetUserId }, "Member removed");
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new NotFoundError("Membership");
    }
    logger.error({ error, roomId, targetUserId }, "Failed to remove member");
    throw new DatabaseError("Failed to remove member");
  }
}
