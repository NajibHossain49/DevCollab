import { Prisma, type User } from "@prisma/client";
import bcrypt from "bcryptjs";

import { prisma } from "../config/database.js";
import { logger } from "../config/logger.js";
import {
  AppError,
  ConflictError,
  DatabaseError,
  NotFoundError,
  UnauthorizedError,
} from "../utils/errors.js";

const BCRYPT_ROUNDS = 12;

interface GithubProfile {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

interface LoginInput {
  email: string;
  password: string;
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

// Registers a new email/password user. Throws ConflictError if the email is
// already taken (by either a credentials or an OAuth account).
export async function registerUser(input: RegisterInput): Promise<User> {
  const { name, email, password } = input;

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictError("An account with this email already exists");
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const created = await prisma.user.create({
      data: { name, email, passwordHash },
    });
    logger.info({ userId: created.id }, "New user registered with password");
    return created;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    // Unique constraint race (two concurrent registrations for one email).
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ConflictError("An account with this email already exists");
    }
    logger.error({ error, email }, "Failed to register user");
    throw new DatabaseError("Failed to register user");
  }
}

// Verifies email/password credentials, returning the user on success.
// Throws UnauthorizedError for unknown emails, wrong passwords, or accounts
// that have no password set (OAuth-only).
export async function verifyCredentials(input: LoginInput): Promise<User> {
  const { email, password } = input;

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      // Run a dummy hash to keep timing consistent whether or not the user
      // exists, mitigating user-enumeration via response timing.
      await bcrypt.compare(password, "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin");
      throw new UnauthorizedError("Invalid email or password");
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedError("Invalid email or password");
    }

    logger.info({ userId: user.id }, "User signed in with password");
    return user;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error({ error, email }, "Failed to verify credentials");
    throw new DatabaseError("Failed to verify credentials");
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
