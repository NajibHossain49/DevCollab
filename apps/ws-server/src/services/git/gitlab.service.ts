import { GitProvider } from "@prisma/client";

import { env } from "../../config/env.js";
import { AppError } from "../../utils/errors.js";
import type {
  GitCommitDto,
  GitFileEntry,
  GitIssueDto,
  GitProviderAdapter,
  GitPullRequestDto,
  GitRepoDto,
  OAuthTokenResult,
  PrState,
  RepoRef,
} from "./types.js";

const BASE = "https://gitlab.com";
const API = `${BASE}/api/v4`;
const SCOPES = "api read_user";

function credentials(): { clientId: string; clientSecret: string } | null {
  if (!env.GITLAB_CLIENT_ID || !env.GITLAB_CLIENT_SECRET) {
    return null;
  }
  return { clientId: env.GITLAB_CLIENT_ID, clientSecret: env.GITLAB_CLIENT_SECRET };
}

async function glFetch<T>(
  url: string,
  accessToken: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new AppError(
      "GIT_PROVIDER_ERROR",
      `GitLab API ${response.status}: ${detail.slice(0, 300)}`,
      response.status === 404 ? 404 : 502,
    );
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

// GitLab addresses projects by id; we stored the numeric id as providerId.
function projectPath(repo: RepoRef): string {
  return encodeURIComponent(repo.providerId);
}

function mapPrState(state: PrState): string {
  if (state === "open") return "opened";
  if (state === "closed") return "closed";
  return "all";
}

export const gitlabAdapter: GitProviderAdapter = {
  provider: GitProvider.GITLAB,

  getAuthorizeUrl(redirectUri: string, state: string): string {
    const creds = credentials();
    if (!creds) {
      throw new AppError("GIT_NOT_CONFIGURED", "GitLab integration is not configured", 503);
    }
    const url = new URL(`${BASE}/oauth/authorize`);
    url.searchParams.set("client_id", creds.clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", SCOPES);
    url.searchParams.set("state", state);
    return url.toString();
  },

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokenResult> {
    const creds = credentials();
    if (!creds) {
      throw new AppError("GIT_NOT_CONFIGURED", "GitLab integration is not configured", 503);
    }
    const res = await fetch(`${BASE}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });
    const token = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };
    if (!res.ok || !token.access_token) {
      throw new AppError("GIT_OAUTH_FAILED", "Failed to exchange GitLab code", 502);
    }

    let accountLogin: string | undefined;
    try {
      const user = await glFetch<{ username: string }>(`${API}/user`, token.access_token);
      accountLogin = user.username;
    } catch {
      // Non-fatal.
    }

    return {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      accountLogin,
      expiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null,
    };
  },

  async getRepos(accessToken: string): Promise<GitRepoDto[]> {
    interface GlProject {
      id: number;
      name: string;
      path_with_namespace: string;
      web_url: string;
      default_branch: string | null;
      visibility: string;
    }
    const projects = await glFetch<GlProject[]>(
      `${API}/projects?membership=true&simple=true&per_page=100&order_by=last_activity_at`,
      accessToken,
    );
    return projects.map((p) => ({
      providerRepoId: String(p.id),
      name: p.name,
      fullName: p.path_with_namespace,
      url: p.web_url,
      defaultBranch: p.default_branch ?? "main",
      isPrivate: p.visibility !== "public",
    }));
  },

  async getRepoFiles(
    accessToken: string,
    repo: RepoRef,
    path: string,
    branch: string,
  ): Promise<GitFileEntry[]> {
    interface GlTreeEntry {
      name: string;
      path: string;
      type: "tree" | "blob";
    }
    const query = new URLSearchParams({ ref: branch, per_page: "100" });
    if (path) query.set("path", path);
    const entries = await glFetch<GlTreeEntry[]>(
      `${API}/projects/${projectPath(repo)}/repository/tree?${query.toString()}`,
      accessToken,
    );
    return entries.map((e) => ({
      name: e.name,
      path: e.path,
      type: e.type === "tree" ? "dir" : "file",
    }));
  },

  async getFileContent(
    accessToken: string,
    repo: RepoRef,
    path: string,
    branch: string,
  ): Promise<string> {
    const filePath = encodeURIComponent(path);
    const res = await fetch(
      `${API}/projects/${projectPath(repo)}/repository/files/${filePath}/raw?ref=${encodeURIComponent(branch)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) {
      throw new AppError("GIT_PROVIDER_ERROR", `GitLab file fetch ${res.status}`, 502);
    }
    return res.text();
  },

  async getCommits(
    accessToken: string,
    repo: RepoRef,
    branch: string,
  ): Promise<GitCommitDto[]> {
    interface GlCommit {
      id: string;
      message: string;
      author_name: string;
      created_at: string;
      web_url: string;
    }
    const commits = await glFetch<GlCommit[]>(
      `${API}/projects/${projectPath(repo)}/repository/commits?ref_name=${encodeURIComponent(branch)}&per_page=30`,
      accessToken,
    );
    return commits.map((c) => ({
      sha: c.id,
      message: c.message,
      author: c.author_name,
      authoredAt: c.created_at,
      url: c.web_url,
    }));
  },

  async getPullRequests(
    accessToken: string,
    repo: RepoRef,
    state: PrState,
  ): Promise<GitPullRequestDto[]> {
    interface GlMr {
      iid: number;
      title: string;
      state: string;
      web_url: string;
      source_branch: string;
      target_branch: string;
    }
    const mrs = await glFetch<GlMr[]>(
      `${API}/projects/${projectPath(repo)}/merge_requests?state=${mapPrState(state)}&per_page=50`,
      accessToken,
    );
    return mrs.map((m) => ({
      number: m.iid,
      title: m.title,
      state: m.state,
      url: m.web_url,
      head: m.source_branch,
      base: m.target_branch,
    }));
  },

  async getIssues(
    accessToken: string,
    repo: RepoRef,
    state: PrState,
  ): Promise<GitIssueDto[]> {
    interface GlIssue {
      iid: number;
      title: string;
      state: string;
      web_url: string;
    }
    const issues = await glFetch<GlIssue[]>(
      `${API}/projects/${projectPath(repo)}/issues?state=${mapPrState(state)}&per_page=50`,
      accessToken,
    );
    return issues.map((i) => ({
      number: i.iid,
      title: i.title,
      state: i.state,
      url: i.web_url,
    }));
  },

  async getBranchSha(accessToken: string, repo: RepoRef, branch: string): Promise<string> {
    const b = await glFetch<{ commit: { id: string } }>(
      `${API}/projects/${projectPath(repo)}/repository/branches/${encodeURIComponent(branch)}`,
      accessToken,
    );
    return b.commit.id;
  },

  async createBranch(
    accessToken: string,
    repo: RepoRef,
    newBranch: string,
    _fromSha: string,
  ): Promise<void> {
    // GitLab creates from a ref name; we pass the source branch name via _fromSha
    // is not used — callers pass the base branch name through fromSha here.
    const query = new URLSearchParams({ branch: newBranch, ref: _fromSha });
    await glFetch(
      `${API}/projects/${projectPath(repo)}/repository/branches?${query.toString()}`,
      accessToken,
      { method: "POST" },
    );
  },

  async commitFile(
    accessToken: string,
    repo: RepoRef,
    branch: string,
    path: string,
    content: string,
    message: string,
  ): Promise<GitCommitDto> {
    // Decide create vs update by probing the file on the branch.
    let action: "create" | "update" = "create";
    try {
      const probe = await fetch(
        `${API}/projects/${projectPath(repo)}/repository/files/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (probe.ok) action = "update";
    } catch {
      action = "create";
    }

    const commit = await glFetch<{
      id: string;
      message: string;
      author_name?: string;
      created_at: string;
      web_url: string;
    }>(`${API}/projects/${projectPath(repo)}/repository/commits`, accessToken, {
      method: "POST",
      body: JSON.stringify({
        branch,
        commit_message: message,
        actions: [{ action, file_path: path, content }],
      }),
    });

    return {
      sha: commit.id,
      message: commit.message,
      author: commit.author_name ?? "devcollab",
      authoredAt: commit.created_at,
      url: commit.web_url,
    };
  },

  async createPullRequest(
    accessToken: string,
    repo: RepoRef,
    title: string,
    body: string,
    head: string,
    base: string,
  ): Promise<GitPullRequestDto> {
    const mr = await glFetch<{
      iid: number;
      title: string;
      state: string;
      web_url: string;
      source_branch: string;
      target_branch: string;
    }>(`${API}/projects/${projectPath(repo)}/merge_requests`, accessToken, {
      method: "POST",
      body: JSON.stringify({
        source_branch: head,
        target_branch: base,
        title,
        description: body,
      }),
    });
    return {
      number: mr.iid,
      title: mr.title,
      state: mr.state,
      url: mr.web_url,
      head: mr.source_branch,
      base: mr.target_branch,
    };
  },

  async createIssue(
    accessToken: string,
    repo: RepoRef,
    title: string,
    body: string,
  ): Promise<GitIssueDto> {
    const query = new URLSearchParams({ title });
    if (body) query.set("description", body);
    const issue = await glFetch<{
      iid: number;
      title: string;
      state: string;
      web_url: string;
    }>(
      `${API}/projects/${projectPath(repo)}/issues?${query.toString()}`,
      accessToken,
      { method: "POST" },
    );
    return { number: issue.iid, title: issue.title, state: issue.state, url: issue.web_url };
  },
};
