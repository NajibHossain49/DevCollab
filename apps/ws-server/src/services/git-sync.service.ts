import { type Room } from "@prisma/client";
import * as Y from "yjs";

import { prisma } from "../config/database.js";
import { logger } from "../config/logger.js";
import { connectionManager } from "../websocket/connection.js";
import { documentManager } from "../websocket/managers/document-manager.js";
import type { GitEventType } from "../websocket/types.js";
import { AppError } from "../utils/errors.js";
import { getDocumentState } from "./document.service.js";
import {
  getRoomRepoContext,
  recordPullRequest,
  type RepoContext,
} from "./git.service.js";
import type { GitCommitDto, GitPullRequestDto } from "./git/types.js";

// Maps a room language to a sensible file extension for the synced buffer.
const EXT_BY_LANGUAGE: Record<string, string> = {
  javascript: "js",
  typescript: "ts",
  python: "py",
  java: "java",
  cpp: "cpp",
  c: "c",
  go: "go",
  rust: "rs",
  ruby: "rb",
  php: "php",
  html: "html",
  css: "css",
  json: "json",
  markdown: "md",
};

// DevCollab syncs a room's single shared buffer to one file in the repo.
function roomFilePath(room: Room): string {
  const ext = EXT_BY_LANGUAGE[room.language] ?? "txt";
  return `devcollab/${room.slug}.${ext}`;
}

// Reads the room's current code: prefer the live in-memory doc, else decode the
// persisted Yjs state from the DB.
async function getRoomCode(roomId: string): Promise<string> {
  const live = documentManager.getExistingDocumentText(roomId);
  if (live !== null) {
    return live;
  }
  const state = await getDocumentState(roomId);
  if (!state) {
    return "";
  }
  const doc = new Y.Doc();
  try {
    Y.applyUpdate(doc, state);
    return doc.getText("code").toString();
  } finally {
    doc.destroy();
  }
}

// Emits a real-time Git event to everyone in the room.
export function broadcastGitEvent(
  roomId: string,
  event: GitEventType,
  message: string,
  extra?: { actor?: string; url?: string },
): void {
  connectionManager.broadcastToRoom(roomId, {
    type: "GIT_EVENT",
    payload: {
      roomId,
      event,
      message,
      actor: extra?.actor,
      url: extra?.url,
      timestamp: new Date().toISOString(),
    },
  });
}

// Room code -> Git repo: commit the shared buffer to a branch.
export async function syncRoomToRepo(
  userId: string,
  roomId: string,
  branch?: string,
  commitMessage?: string,
): Promise<GitCommitDto> {
  const { room, ctx } = await getRoomRepoContext(userId, roomId);
  const targetBranch = branch ?? ctx.repo.defaultBranch;
  const code = await getRoomCode(roomId);
  const path = roomFilePath(room);
  const message = commitMessage ?? `DevCollab sync: ${room.name}`;

  const commit = await ctx.adapter.commitFile(
    ctx.token,
    ctx.repoRef,
    targetBranch,
    path,
    code,
    message,
  );

  await prisma.gitRepo.update({
    where: { id: ctx.repo.id },
    data: { lastSyncAt: new Date() },
  });

  broadcastGitEvent(roomId, "commit", `Room synced to ${ctx.repo.fullName}@${targetBranch}`, {
    url: commit.url,
  });
  logger.info({ roomId, repo: ctx.repo.fullName, branch: targetBranch }, "Room synced to repo");
  return commit;
}

// Git repo -> room code: pull the synced file into the shared buffer and push a
// DOC_SYNC to every connected client, then persist.
export async function syncRepoToRoom(
  userId: string,
  roomId: string,
  branch?: string,
): Promise<void> {
  const { room, ctx } = await getRoomRepoContext(userId, roomId);
  const sourceBranch = branch ?? ctx.repo.defaultBranch;
  const path = roomFilePath(room);

  let content: string;
  try {
    content = await ctx.adapter.getFileContent(ctx.token, ctx.repoRef, path, sourceBranch);
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 404) {
      throw new AppError(
        "NO_SYNCED_FILE",
        `No synced file (${path}) found on ${sourceBranch}. Push from the room first.`,
        404,
      );
    }
    throw error;
  }

  const state = documentManager.replaceDocumentText(roomId, content);
  connectionManager.broadcastToRoom(roomId, {
    type: "DOC_SYNC",
    payload: { roomId, update: Array.from(state) },
  });
  await documentManager.persistDocument(roomId);

  await prisma.gitRepo.update({
    where: { id: ctx.repo.id },
    data: { lastSyncAt: new Date() },
  });

  broadcastGitEvent(roomId, "repo_synced", `Room updated from ${ctx.repo.fullName}@${sourceBranch}`);
  logger.info({ roomId, repo: ctx.repo.fullName, branch: sourceBranch }, "Repo synced to room");
}

// Creates a branch, syncs the room code to it, and opens a PR on the provider.
export async function createPullRequestFromRoom(
  userId: string,
  roomId: string,
  title: string,
  description: string | undefined,
  headBranch?: string,
  baseBranch?: string,
): Promise<GitPullRequestDto> {
  const { room, ctx } = await getRoomRepoContext(userId, roomId);
  const base = baseBranch ?? ctx.repo.defaultBranch;
  const head =
    headBranch ?? `devcollab/${room.slug}-${Date.now().toString(36)}`;

  // Branch off the base tip, unless the caller targets an existing branch.
  if (!headBranch) {
    const baseSha = await ctx.adapter.getBranchSha(ctx.token, ctx.repoRef, base);
    await createBranchCompat(ctx, head, baseSha, base);
  }

  // Push the current room code onto the head branch.
  const code = await getRoomCode(roomId);
  await ctx.adapter.commitFile(
    ctx.token,
    ctx.repoRef,
    head,
    roomFilePath(room),
    code,
    `DevCollab PR: ${title}`,
  );

  const pr = await ctx.adapter.createPullRequest(
    ctx.token,
    ctx.repoRef,
    title,
    description ?? "",
    head,
    base,
  );

  await recordPullRequest({
    roomId,
    provider: ctx.integration.provider,
    prNumber: pr.number,
    title: pr.title,
    description: description ?? null,
    branchFrom: pr.head,
    branchTo: pr.base,
    url: pr.url,
    createdBy: userId,
  });

  broadcastGitEvent(roomId, "pr_created", `Pull request #${pr.number} opened: ${pr.title}`, {
    url: pr.url,
  });
  logger.info({ roomId, prNumber: pr.number }, "Pull request created from room");
  return pr;
}

// GitLab's createBranch takes a ref name rather than a sha; pass the base name
// there while other providers use the resolved sha.
async function createBranchCompat(
  ctx: RepoContext,
  newBranch: string,
  baseSha: string,
  baseName: string,
): Promise<void> {
  if (ctx.integration.provider === "GITLAB") {
    await ctx.adapter.createBranch(ctx.token, ctx.repoRef, newBranch, baseName);
    return;
  }
  await ctx.adapter.createBranch(ctx.token, ctx.repoRef, newBranch, baseSha);
}
