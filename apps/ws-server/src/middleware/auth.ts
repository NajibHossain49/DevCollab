import { MemberRole } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";

import { prisma } from "../config/database.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { ForbiddenError, UnauthorizedError } from "../utils/errors.js";

// Auth.js / NextAuth session cookie names (with and without secure prefix).
const SESSION_COOKIE_NAMES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
  "token",
] as const;

function parseCookies(header: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) {
      continue;
    }
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) {
      cookies[key] = decodeURIComponent(value);
    }
  }
  return cookies;
}

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length).trim();
  }

  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const cookies = parseCookies(cookieHeader);
    for (const name of SESSION_COOKIE_NAMES) {
      const value = cookies[name];
      if (value) {
        return value;
      }
    }
  }

  return null;
}

function getUserIdFromPayload(payload: string | JwtPayload): string | null {
  if (typeof payload === "string") {
    return null;
  }
  const record = payload as Record<string, unknown>;
  const candidate = payload.sub ?? record["userId"] ?? record["id"];
  return typeof candidate === "string" ? candidate : null;
}

// Verifies the request's JWT (Authorization header or session cookie) and
// attaches the corresponding user to `req.user`.
export async function verifyAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = extractToken(req);
    if (!token) {
      throw new UnauthorizedError("Missing authentication token");
    }

    let payload: string | JwtPayload;
    try {
      payload = jwt.verify(token, env.NEXTAUTH_SECRET);
    } catch {
      throw new UnauthorizedError("Invalid or expired token");
    }

    const userId = getUserIdFromPayload(payload);
    if (!userId) {
      throw new UnauthorizedError("Token is missing a subject");
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedError("User no longer exists");
    }

    req.user = user;
    logger.debug({ userId }, "Request authenticated");
    next();
  } catch (error) {
    next(error);
  }
}

async function resolveRoomId(req: Request): Promise<string | null> {
  const params = req.params as Record<string, string | undefined>;
  const body = (req.body ?? {}) as { roomId?: unknown };

  const direct = params["roomId"] ?? body.roomId;
  if (typeof direct === "string") {
    return direct;
  }

  const slug = params["slug"];
  if (typeof slug === "string") {
    const room = await prisma.room.findUnique({ where: { slug }, select: { id: true } });
    return room?.id ?? null;
  }

  return null;
}

// Guards a route by room role. Must run after `verifyAuth`. Looks up the
// caller's RoomMember record and attaches it to `req.membership`.
export function requireRole(
  roles: MemberRole[],
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError("Authentication required");
      }

      const roomId = await resolveRoomId(req);
      if (!roomId) {
        throw new ForbiddenError("Room context is required");
      }

      const membership = await prisma.roomMember.findUnique({
        where: { roomId_userId: { roomId, userId: req.user.id } },
      });

      if (!membership || !roles.includes(membership.role)) {
        throw new ForbiddenError("Insufficient permissions for this room");
      }

      req.membership = membership;
      logger.debug({ userId: req.user.id, roomId, role: membership.role }, "Role authorized");
      next();
    } catch (error) {
      next(error);
    }
  };
}
