import { Prisma, type User } from "@prisma/client";

import { prisma } from "../config/database.js";
import { logger } from "../config/logger.js";
import { AppError, DatabaseError, NotFoundError } from "../utils/errors.js";

interface GithubProfile {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

interface UpdateUserData {
  name?: string;
  avatar?: string;
}

// Finds a user by their GitHub id, creating one on first sign-in.
export async function findOrCreateUser(githubProfile: GithubProfile): Promise<User> {
  const { id: githubId, email, name, avatar } = githubProfile;

  try {
    const existing = await prisma.user.findUnique({ where: { githubId } });
    if (existing) {
      logger.info({ userId: existing.id, githubId }, "Existing user signed in");
      return existing;
    }

    const created = await prisma.user.create({
      data: { githubId, email, name, avatar: avatar ?? null },
    });
    logger.info({ userId: created.id, githubId }, "New user created");
    return created;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error({ error, githubId }, "Failed to find or create user");
    throw new DatabaseError("Failed to find or create user");
  }
}

export async function getUserById(id: string): Promise<User> {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundError("User");
    }
    return user;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error({ error, userId: id }, "Failed to get user by id");
    throw new DatabaseError("Failed to retrieve user");
  }
}

export async function updateUser(id: string, data: UpdateUserData): Promise<User> {
  try {
    const user = await prisma.user.update({ where: { id }, data });
    logger.info({ userId: id }, "User updated");
    return user;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new NotFoundError("User");
    }
    logger.error({ error, userId: id }, "Failed to update user");
    throw new DatabaseError("Failed to update user");
  }
}
