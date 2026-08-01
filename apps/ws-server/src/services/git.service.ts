import {
  GitProvider,
  Prisma,
  type GitIntegration,
  type GitRepo,
  type Room,
} from "@prisma/client";
import jwt from "jsonwebtoken";

import { prisma } from "../config/database.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { decrypt, encrypt } from "../utils/crypto.js";
import {
  AppError,
  DatabaseError,
  ForbiddenError,
  NotFoundError,
} from "../utils/errors.js";
import { getAdapter } from "./git/provider.js";
import type {
  GitCommitDto,
  GitFileEntry,
  GitIssueDto,
  GitProviderAdapter,
  GitPullRequestDto,
  PrState,
  RepoRef,
} from "./git/types.js";

const OAUTH_STATE_PURPOSE = "git_oauth";
const OAUTH_STATE_TTL = "10m";

interface OAuthStatePayload {
  purpose: typeof OAUTH_STATE_PURPOSE;
  userId: string;
  provider: GitProvider;
}

// Reports which providers have OAuth credentials configured (for the UI).
export function getConfiguredProviders(): GitProvider[] {
  const configured: GitProvider[] = [];
  if ((env.GIT_GITHUB_CLIENT_ID ?? env.GITHUB_CLIENT_ID) && (env.GIT_GITHUB_CLIENT_SECRET ?? env.GITHUB_CLIENT_SECRET)) {
    configured.push(GitProvider.GITHUB);
  }
  if (env.GITLAB_CLIENT_ID && env.GITLAB_CLIENT_SECRET) {
    configured.push(GitProvider.GITLAB);
  }
  if (env.BITBUCKET_CLIENT_ID && env.BITBUCKET_CLIENT_SECRET) {
    configured.push(GitProvider.BITBUCKET);
  }
  return configured;
}

// ---------------------------------------------------------------------------
// OAuth connect / callback
// ---------------------------------------------------------------------------
export function buildConnectUrl(
  provider: GitProvider,
  userId: string,
  redirectUri: string,
): string {
  const adapter = getAdapter(provider);
  const state = jwt.sign(
    { purpose: OAUTH_STATE_PURPOSE, userId, provider } satisfies OAuthStatePayload,
    env.NEXTAUTH_SECRET,
    { expiresIn: OAUTH_STATE_TTL },
  );
  return adapter.getAuthorizeUrl(redirectUri, state);
}

export async function handleOAuthCallback(
  provider: GitProvider,
  code: string,
  state: string,
  redirectUri: string,
): Promise<{ userId: string }> {
  let payload: OAuthStatePayload;
  try {
    const decoded = jwt.verify(state, env.NEXTAUTH_SECRET);
    if (typeof decoded === "string" || decoded.purpose !== OAUTH_STATE_PURPOSE) {
      throw new AppError("GIT_OAUTH_FAILED", "Invalid OAuth state", 400);
    }
    payload = decoded as unknown as OAuthStatePayload;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("GIT_OAUTH_FAILED", "OAuth state is invalid or expired", 400);
  }

  if (payload.provider !== provider) {
    throw new AppError("GIT_OAUTH_FAILED", "OAuth provider mismatch", 400);
  }

  const adapter = getAdapter(provider);
  const token = await adapter.exchangeCode(code, redirectUri);

  try {
    await prisma.gitIntegration.upsert({
      where: { provider_ownerId: { provider, ownerId: payload.userId } },
      create: {
        provider,
        ownerId: payload.userId,
        accessToken: encrypt(token.accessToken),
        refreshToken: token.refreshToken ? encrypt(token.refreshToken) : null,
        accountLogin: token.accountLogin ?? null,
        tokenExpiresAt: token.expiresAt ?? null,
      },
      update: {
        accessToken: encrypt(token.accessToken),
        refreshToken: token.refreshToken ? encrypt(token.refreshToken) : null,
        accountLogin: token.accountLogin ?? null,
        tokenExpiresAt: token.expiresAt ?? null,
      },
    });
  } catch (error) {
    logger.error({ error, provider, userId: payload.userId }, "Failed to store integration");
    throw new DatabaseError("Failed to save Git integration");
  }

  logger.info({ provider, userId: payload.userId }, "Git integration connected");
  return { userId: payload.userId };
}

// ---------------------------------------------------------------------------
// Integrations
// ---------------------------------------------------------------------------
export interface IntegrationDto {
  id: string;
  provider: GitProvider;
  accountLogin: string | null;
  createdAt: string;
}

export async function getIntegrations(userId: string): Promise<IntegrationDto[]> {
  try {
    const integrations = await prisma.gitIntegration.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: "asc" },
    });
    return integrations.map((i) => ({
      id: i.id,
      provider: i.provider,
      accountLogin: i.accountLogin,
      createdAt: i.createdAt.toISOString(),
    }));
  } catch (error) {
    logger.error({ error, userId }, "Failed to list integrations");
    throw new DatabaseError("Failed to list integrations");
  }
}

export async function disconnectIntegration(
  integrationId: string,
  userId: string,
): Promise<void> {
  try {
    const integration = await prisma.gitIntegration.findUnique({
      where: { id: integrationId },
    });
    if (!integration) throw new NotFoundError("Integration");
    if (integration.ownerId !== userId) {
      throw new ForbiddenError("You do not own this integration");
    }
    await prisma.gitIntegration.delete({ where: { id: integrationId } });
    logger.info({ integrationId, userId }, "Git integration disconnected");
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error({ error, integrationId }, "Failed to disconnect integration");
    throw new DatabaseError("Failed to disconnect integration");
  }
}

// ---------------------------------------------------------------------------
// Repos
// ---------------------------------------------------------------------------
export interface RepoDto {
  id: string;
  provider: GitProvider;
  providerRepoId: string;
  name: string;
  fullName: string;
  url: string;
  defaultBranch: string;
  isPrivate: boolean;
  isLinked: boolean;
  linkedRoomId: string | null;
}

function toRepoDto(repo: GitRepo, provider: GitProvider): RepoDto {
  return {
    id: repo.id,
    provider,
    providerRepoId: repo.providerRepoId,
    name: repo.name,
    fullName: repo.fullName,
    url: repo.url,
    defaultBranch: repo.defaultBranch,
    isPrivate: repo.isPrivate,
    isLinked: repo.isLinked,
    linkedRoomId: repo.linkedRoomId,
  };
}

// Fetches repos live from every connected provider (or a single one) and
// upserts them so we have stable local ids for linking/syncing.
export async function listRepos(
  userId: string,
  provider?: GitProvider,
): Promise<RepoDto[]> {
  try {
    const integrations = await prisma.gitIntegration.findMany({
      where: { ownerId: userId, ...(provider ? { provider } : {}) },
    });

    const result: RepoDto[] = [];
    for (const integration of integrations) {
      const adapter = getAdapter(integration.provider);
      const token = decrypt(integration.accessToken);
      let remoteRepos;
      try {
        remoteRepos = await adapter.getRepos(token);
      } catch (error) {
        logger.warn(
          { error, provider: integration.provider },
          "Failed to fetch repos from provider",
        );
        continue;
      }

      for (const remote of remoteRepos) {
        const saved = await prisma.gitRepo.upsert({
          where: {
            integrationId_providerRepoId: {
              integrationId: integration.id,
              providerRepoId: remote.providerRepoId,
            },
          },
          create: {
            integrationId: integration.id,
            providerRepoId: remote.providerRepoId,
            name: remote.name,
            fullName: remote.fullName,
            url: remote.url,
            defaultBranch: remote.defaultBranch,
            isPrivate: remote.isPrivate,
          },
          update: {
            name: remote.name,
            fullName: remote.fullName,
            url: remote.url,
            defaultBranch: remote.defaultBranch,
            isPrivate: remote.isPrivate,
          },
        });
        result.push(toRepoDto(saved, integration.provider));
      }
    }
    return result;
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error({ error, userId }, "Failed to list repos");
    throw new DatabaseError("Failed to list repos");
  }
}

// Resolves a repo plus its integration, adapter, decrypted token, and RepoRef.
export interface RepoContext {
  repo: GitRepo;
  integration: GitIntegration;
  adapter: GitProviderAdapter;
  token: string;
  repoRef: RepoRef;
}

export async function getRepoContext(repoId: string): Promise<RepoContext> {
  const repo = await prisma.gitRepo.findUnique({
    where: { id: repoId },
    include: { integration: true },
  });
  if (!repo) throw new NotFoundError("Repository");
  const integration = repo.integration;
  return {
    repo,
    integration,
    adapter: getAdapter(integration.provider),
    token: decrypt(integration.accessToken),
    repoRef: { fullName: repo.fullName, providerId: repo.providerRepoId },
  };
}

function assertRepoOwner(integration: GitIntegration, userId: string): void {
  if (integration.ownerId !== userId) {
    throw new ForbiddenError("You do not have access to this repository");
  }
}

export async function assertRoomMember(userId: string, roomId: string): Promise<Room> {
  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room) throw new NotFoundError("Room");
  if (room.ownerId === userId) return room;
  const membership = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId, userId } },
  });
  if (!membership) {
    throw new ForbiddenError("You are not a member of this room");
  }
  return room;
}

export async function linkRepoToRoom(
  repoId: string,
  userId: string,
  roomId: string,
): Promise<RepoDto> {
  try {
    const ctx = await getRepoContext(repoId);
    assertRepoOwner(ctx.integration, userId);
    await assertRoomMember(userId, roomId);

    const [updatedRepo] = await prisma.$transaction([
      prisma.gitRepo.update({
        where: { id: repoId },
        data: { isLinked: true, linkedRoomId: roomId },
      }),
      prisma.room.update({ where: { id: roomId }, data: { gitRepoId: repoId } }),
    ]);

    logger.info({ repoId, roomId, userId }, "Repo linked to room");
    return toRepoDto(updatedRepo, ctx.integration.provider);
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error({ error, repoId, roomId }, "Failed to link repo");
    throw new DatabaseError("Failed to link repository");
  }
}

// Resolves the repo linked to a room (via Room.gitRepoId), for room-scoped ops.
export async function getRoomRepoContext(
  userId: string,
  roomId: string,
): Promise<{ room: Room; ctx: RepoContext }> {
  const room = await assertRoomMember(userId, roomId);
  if (!room.gitRepoId) {
    throw new AppError("NO_LINKED_REPO", "This room has no linked repository", 400);
  }
  const ctx = await getRepoContext(room.gitRepoId);
  return { room, ctx };
}

export async function getRepoFiles(
  repoId: string,
  userId: string,
  path: string,
  branch: string | undefined,
): Promise<GitFileEntry[]> {
  const ctx = await getRepoContext(repoId);
  assertRepoOwner(ctx.integration, userId);
  return ctx.adapter.getRepoFiles(
    ctx.token,
    ctx.repoRef,
    path,
    branch ?? ctx.repo.defaultBranch,
  );
}

export async function getFileContent(
  repoId: string,
  userId: string,
  path: string,
  branch: string | undefined,
): Promise<string> {
  const ctx = await getRepoContext(repoId);
  assertRepoOwner(ctx.integration, userId);
  return ctx.adapter.getFileContent(
    ctx.token,
    ctx.repoRef,
    path,
    branch ?? ctx.repo.defaultBranch,
  );
}

// ---------------------------------------------------------------------------
// Pull requests / commits / issues (room-scoped)
// ---------------------------------------------------------------------------
export async function listPullRequests(
  userId: string,
  roomId: string,
  state: PrState,
): Promise<GitPullRequestDto[]> {
  const { ctx } = await getRoomRepoContext(userId, roomId);
  return ctx.adapter.getPullRequests(ctx.token, ctx.repoRef, state);
}

export async function getCommits(
  userId: string,
  roomId: string,
  branch: string | undefined,
): Promise<GitCommitDto[]> {
  const { ctx } = await getRoomRepoContext(userId, roomId);
  return ctx.adapter.getCommits(ctx.token, ctx.repoRef, branch ?? ctx.repo.defaultBranch);
}

export async function getIssues(
  userId: string,
  roomId: string,
  state: PrState,
): Promise<GitIssueDto[]> {
  const { ctx } = await getRoomRepoContext(userId, roomId);
  return ctx.adapter.getIssues(ctx.token, ctx.repoRef, state);
}

export async function createIssueFromRoom(
  userId: string,
  roomId: string,
  title: string,
  body: string,
): Promise<GitIssueDto> {
  const { ctx } = await getRoomRepoContext(userId, roomId);
  const issue = await ctx.adapter.createIssue(ctx.token, ctx.repoRef, title, body);
  logger.info({ roomId, number: issue.number }, "Issue created from room");
  return issue;
}

// Stores a PR record locally (source of truth remains the provider).
export async function recordPullRequest(data: {
  roomId: string;
  provider: GitProvider;
  prNumber: number;
  title: string;
  description: string | null;
  branchFrom: string;
  branchTo: string;
  url: string;
  createdBy: string;
}): Promise<void> {
  try {
    await prisma.pullRequest.create({ data });
  } catch (error) {
    // Non-fatal: a duplicate or race shouldn't fail the PR creation flow.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return;
    }
    logger.warn({ error, roomId: data.roomId }, "Failed to record pull request locally");
  }
}
