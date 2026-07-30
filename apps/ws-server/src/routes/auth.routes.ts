import { randomBytes } from "node:crypto";

import type { User } from "@prisma/client";
import { Router, type Request, type Response } from "express";
import jwt from "jsonwebtoken";

import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { verifyAuth } from "../middleware/auth.js";
import { authLimiter } from "../middleware/rate-limit.js";
import { validate } from "../middleware/validate.js";
import {
  findOrCreateUser,
  registerUser,
  verifyCredentials,
} from "../services/user.service.js";
import { asyncHandler, getUser } from "../utils/async-handler.js";
import { UnauthorizedError } from "../utils/errors.js";
import {
  githubCallbackSchema,
  loginSchema,
  registerSchema,
  signinSchema,
} from "../utils/validators.js";
import type { ApiResponse } from "../types/index.js";

const router = Router();

const JWT_EXPIRES_IN = "7d";
const SESSION_COOKIE = "token";

function signToken(user: Pick<User, "id" | "email" | "name">): string {
  return jwt.sign(
    { sub: user.id, email: user.email, name: user.name },
    env.NEXTAUTH_SECRET,
    { expiresIn: JWT_EXPIRES_IN },
  );
}

// Never leak the password hash to clients.
type SafeUser = Omit<User, "passwordHash">;

function toSafeUser(user: User): SafeUser {
  const { passwordHash: _passwordHash, ...safe } = user;
  return safe;
}

interface GithubProfile {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

interface GithubTokenResponse {
  access_token?: string;
  error?: string;
}

interface GithubUserResponse {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
}

async function exchangeGithubCode(code: string): Promise<GithubProfile> {
  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  const token = (await tokenResponse.json()) as GithubTokenResponse;
  if (!tokenResponse.ok || !token.access_token) {
    throw new UnauthorizedError("Failed to exchange GitHub code");
  }

  const userResponse = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "devcollab",
    },
  });

  if (!userResponse.ok) {
    throw new UnauthorizedError("Failed to fetch GitHub profile");
  }

  const profile = (await userResponse.json()) as GithubUserResponse;
  return {
    id: String(profile.id),
    email: profile.email ?? `${profile.login}@users.noreply.github.com`,
    name: profile.name ?? profile.login,
    avatar: profile.avatar_url ?? undefined,
  };
}

// POST /api/auth/signin — returns the GitHub OAuth authorization URL.
router.post(
  "/signin",
  authLimiter,
  validate(signinSchema),
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const state = randomBytes(16).toString("hex");
    const url = new URL("https://github.com/login/oauth/authorize");
    url.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
    url.searchParams.set("redirect_uri", `${env.NEXTAUTH_URL}/api/auth/callback/github`);
    url.searchParams.set("scope", "read:user user:email");
    url.searchParams.set("state", state);

    const body: ApiResponse<{ url: string }> = {
      success: true,
      data: { url: url.toString() },
    };
    res.status(200).json(body);
  }),
);

// POST /api/auth/callback/github — exchanges the code and issues a JWT.
router.post(
  "/callback/github",
  authLimiter,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { code } = githubCallbackSchema.parse(req.query);
    const profile = await exchangeGithubCode(code);

    const user = await findOrCreateUser(profile);
    const token = signToken(user);

    logger.info({ userId: user.id }, "GitHub OAuth callback succeeded");

    const body: ApiResponse<{ user: SafeUser; token: string }> = {
      success: true,
      data: { user: toSafeUser(user), token },
    };
    res.status(200).json(body);
  }),
);

// POST /api/auth/register — creates an email/password account and returns a
// JWT the client can use immediately for API/WebSocket auth.
router.post(
  "/register",
  authLimiter,
  validate(registerSchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const input = registerSchema.parse(req.body);
    const user = await registerUser(input);
    const token = signToken(user);

    logger.info({ userId: user.id }, "User registered with email/password");

    const body: ApiResponse<{ user: SafeUser; token: string }> = {
      success: true,
      data: { user: toSafeUser(user), token },
    };
    res.status(201).json(body);
  }),
);

// POST /api/auth/login — verifies email/password credentials and returns a JWT.
router.post(
  "/login",
  authLimiter,
  validate(loginSchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const input = loginSchema.parse(req.body);
    const user = await verifyCredentials(input);
    const token = signToken(user);

    logger.info({ userId: user.id }, "User logged in with email/password");

    const body: ApiResponse<{ user: SafeUser; token: string }> = {
      success: true,
      data: { user: toSafeUser(user), token },
    };
    res.status(200).json(body);
  }),
);

// POST /api/auth/signout — clears the session cookie.
router.post(
  "/signout",
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    res.clearCookie(SESSION_COOKIE);
    const body: ApiResponse<never> = { success: true };
    res.status(200).json(body);
  }),
);

// GET /api/auth/session — returns the current authenticated user.
router.get(
  "/session",
  verifyAuth,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const user = getUser(req);
    const body: ApiResponse<{ user: SafeUser | null }> = {
      success: true,
      data: { user: toSafeUser(user) },
    };
    res.status(200).json(body);
  }),
);

export default router;
