import { Router, type Request, type Response } from "express";

import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { verifyAuth } from "../middleware/auth.js";
import { validate, validateParams, validateQuery } from "../middleware/validate.js";
import {
  createIssueFromRoom,
  disconnectIntegration,
  getCommits,
  getConfiguredProviders,
  getFileContent,
  getIntegrations,
  getIssues,
  getRepoFiles,
  handleOAuthCallback,
  linkRepoToRoom,
  listPullRequests,
  listRepos,
  buildConnectUrl,
  type IntegrationDto,
  type RepoDto,
} from "../services/git.service.js";
import {
  createPullRequestFromRoom,
  syncRepoToRoom,
  syncRoomToRepo,
} from "../services/git-sync.service.js";
import { providerFromSlug, slugFromProvider } from "../services/git/provider.js";
import type {
  GitCommitDto,
  GitIssueDto,
  GitPullRequestDto,
} from "../services/git/types.js";
import { asyncHandler, getUser } from "../utils/async-handler.js";
import {
  commitsQuerySchema,
  createIssueSchema,
  createPullRequestSchema,
  fileContentQuerySchema,
  gitProviderParamSchema,
  idParamSchema,
  linkRepoSchema,
  listByRoomQuerySchema,
  repoFilesQuerySchema,
  syncRepoSchema,
  type GitProviderSlug,
} from "../utils/validators.js";
import type { ApiResponse } from "../types/index.js";

const router = Router();

// Builds this API's public base URL, used for OAuth redirect URIs.
function apiBaseUrl(req: Request): string {
  if (env.API_PUBLIC_URL) {
    return env.API_PUBLIC_URL.replace(/\/$/, "");
  }
  const proto =
    (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0] ?? req.protocol;
  const host = (req.headers["x-forwarded-host"] as string | undefined) ?? req.get("host");
  return `${proto}://${host}`;
}

function gitRedirectUri(req: Request, slug: GitProviderSlug): string {
  return `${apiBaseUrl(req)}/api/git/${slug}/callback`;
}

// ---------------------------------------------------------------------------
// PUBLIC: OAuth callback (redirect target from the provider). Declared before
// verifyAuth since the provider calls it without our auth token; the user is
// recovered from the signed `state`.
// ---------------------------------------------------------------------------
router.get(
  "/:provider/callback",
  validateParams(gitProviderParamSchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { provider } = gitProviderParamSchema.parse(req.params);
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";
    const webBase = (env.WEB_APP_URL ?? env.NEXTAUTH_URL).replace(/\/$/, "");

    if (!code || !state) {
      res.redirect(`${webBase}/settings?git=error&reason=missing_code`);
      return;
    }

    try {
      await handleOAuthCallback(
        providerFromSlug(provider),
        code,
        state,
        gitRedirectUri(req, provider),
      );
      res.redirect(`${webBase}/settings?git=connected&provider=${provider}`);
    } catch (error) {
      logger.error({ error, provider }, "Git OAuth callback failed");
      res.redirect(`${webBase}/settings?git=error&provider=${provider}`);
    }
  }),
);

// All remaining routes require authentication.
router.use(verifyAuth);

// GET /api/git/providers — configured providers + the user's integrations.
router.get(
  "/providers",
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const user = getUser(req);
    const configured = getConfiguredProviders().map(slugFromProvider);
    const integrations = await getIntegrations(user.id);

    const body: ApiResponse<{
      configured: GitProviderSlug[];
      integrations: IntegrationDto[];
    }> = { success: true, data: { configured, integrations } };
    res.status(200).json(body);
  }),
);

// GET /api/git/:provider/connect — returns the OAuth authorize URL.
router.get(
  "/:provider/connect",
  validateParams(gitProviderParamSchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const user = getUser(req);
    const { provider } = gitProviderParamSchema.parse(req.params);
    const url = buildConnectUrl(
      providerFromSlug(provider),
      user.id,
      gitRedirectUri(req, provider),
    );

    const body: ApiResponse<{ url: string }> = { success: true, data: { url } };
    res.status(200).json(body);
  }),
);

// DELETE /api/git/integrations/:id — disconnect an integration.
router.delete(
  "/integrations/:id",
  validateParams(idParamSchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const user = getUser(req);
    const { id } = idParamSchema.parse(req.params);
    await disconnectIntegration(id, user.id);

    const body: ApiResponse<never> = { success: true };
    res.status(200).json(body);
  }),
);

// GET /api/git/repos — list connected repos (optionally filtered by provider).
router.get(
  "/repos",
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const user = getUser(req);
    const providerQuery = req.query.provider;
    const provider =
      typeof providerQuery === "string"
        ? providerFromSlug(gitProviderParamSchema.shape.provider.parse(providerQuery))
        : undefined;
    const repos = await listRepos(user.id, provider);

    const body: ApiResponse<{ repos: RepoDto[] }> = {
      success: true,
      data: { repos },
    };
    res.status(200).json(body);
  }),
);

// POST /api/git/repos/:id/link — link a repo to a room.
router.post(
  "/repos/:id/link",
  validateParams(idParamSchema),
  validate(linkRepoSchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const user = getUser(req);
    const { id } = idParamSchema.parse(req.params);
    const { roomId } = linkRepoSchema.parse(req.body);
    const repo = await linkRepoToRoom(id, user.id, roomId);

    const body: ApiResponse<{ repo: RepoDto }> = { success: true, data: { repo } };
    res.status(200).json(body);
  }),
);

// POST /api/git/repos/:id/sync — sync room <-> repo in either direction.
router.post(
  "/repos/:id/sync",
  validateParams(idParamSchema),
  validate(syncRepoSchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const user = getUser(req);
    const { roomId, direction, branch, commitMessage } = syncRepoSchema.parse(req.body);

    if (direction === "toRoom") {
      await syncRepoToRoom(user.id, roomId, branch);
      const body: ApiResponse<{ direction: string }> = {
        success: true,
        data: { direction },
      };
      res.status(200).json(body);
      return;
    }

    const commit = await syncRoomToRepo(user.id, roomId, branch, commitMessage);
    const body: ApiResponse<{ commit: GitCommitDto }> = {
      success: true,
      data: { commit },
    };
    res.status(200).json(body);
  }),
);

// GET /api/git/repos/:id/files — list files at a path.
router.get(
  "/repos/:id/files",
  validateParams(idParamSchema),
  validateQuery(repoFilesQuerySchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const user = getUser(req);
    const { id } = idParamSchema.parse(req.params);
    const { path, branch } = repoFilesQuerySchema.parse(req.query);
    const files = await getRepoFiles(id, user.id, path ?? "", branch);

    const body: ApiResponse<{ files: typeof files }> = {
      success: true,
      data: { files },
    };
    res.status(200).json(body);
  }),
);

// GET /api/git/repos/:id/content — get a file's content.
router.get(
  "/repos/:id/content",
  validateParams(idParamSchema),
  validateQuery(fileContentQuerySchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const user = getUser(req);
    const { id } = idParamSchema.parse(req.params);
    const { path, branch } = fileContentQuerySchema.parse(req.query);
    const content = await getFileContent(id, user.id, path, branch);

    const body: ApiResponse<{ path: string; content: string }> = {
      success: true,
      data: { path, content },
    };
    res.status(200).json(body);
  }),
);

// POST /api/git/pull-requests — create a PR from the room.
router.post(
  "/pull-requests",
  validate(createPullRequestSchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const user = getUser(req);
    const { roomId, title, description, headBranch, baseBranch } =
      createPullRequestSchema.parse(req.body);
    const pr = await createPullRequestFromRoom(
      user.id,
      roomId,
      title,
      description,
      headBranch,
      baseBranch,
    );

    const body: ApiResponse<{ pullRequest: GitPullRequestDto }> = {
      success: true,
      data: { pullRequest: pr },
    };
    res.status(201).json(body);
  }),
);

// GET /api/git/pull-requests — list PRs for a room's linked repo.
router.get(
  "/pull-requests",
  validateQuery(listByRoomQuerySchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const user = getUser(req);
    const { roomId, state } = listByRoomQuerySchema.parse(req.query);
    const pullRequests = await listPullRequests(user.id, roomId, state);

    const body: ApiResponse<{ pullRequests: GitPullRequestDto[] }> = {
      success: true,
      data: { pullRequests },
    };
    res.status(200).json(body);
  }),
);

// GET /api/git/commits — list commits for a room's linked repo.
router.get(
  "/commits",
  validateQuery(commitsQuerySchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const user = getUser(req);
    const { roomId, branch } = commitsQuerySchema.parse(req.query);
    const commits = await getCommits(user.id, roomId, branch);

    const body: ApiResponse<{ commits: GitCommitDto[] }> = {
      success: true,
      data: { commits },
    };
    res.status(200).json(body);
  }),
);

// GET /api/git/issues — list issues for a room's linked repo.
router.get(
  "/issues",
  validateQuery(listByRoomQuerySchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const user = getUser(req);
    const { roomId, state } = listByRoomQuerySchema.parse(req.query);
    const issues = await getIssues(user.id, roomId, state);

    const body: ApiResponse<{ issues: GitIssueDto[] }> = {
      success: true,
      data: { issues },
    };
    res.status(200).json(body);
  }),
);

// POST /api/git/issues — create an issue from the room.
router.post(
  "/issues",
  validate(createIssueSchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const user = getUser(req);
    const { roomId, title, body: issueBody } = createIssueSchema.parse(req.body);
    const issue = await createIssueFromRoom(user.id, roomId, title, issueBody ?? "");

    const body: ApiResponse<{ issue: GitIssueDto }> = {
      success: true,
      data: { issue },
    };
    res.status(201).json(body);
  }),
);

export default router;
