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

const API = "https://api.github.com";
const OAUTH_AUTHORIZE = "https://github.com/login/oauth/authorize";
const OAUTH_TOKEN = "https://github.com/login/oauth/access_token";
// repo = read/write code + PRs; read:user = account login; write:issues via repo.
const SCOPES = "repo read:user";

function credentials(): { clientId: string; clientSecret: string } | null {
  // Prefer a dedicated Git OAuth app, else fall back to the auth OAuth app.
  const clientId = env.GIT_GITHUB_CLIENT_ID ?? env.GITHUB_CLIENT_ID;
  const clientSecret = env.GIT_GITHUB_CLIENT_SECRET ?? env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return null;
  }
  return { clientId, clientSecret };
}

function authHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "devcollab",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function ghFetch<T>(
  url: string,
  accessToken: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { ...authHeaders(accessToken), ...(init?.headers ?? {}) },
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new AppError(
      "GIT_PROVIDER_ERROR",
      `GitHub API ${response.status}: ${detail.slice(0, 300)}`,
      response.status === 404 ? 404 : 502,
    );
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

interface GhRepo {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  default_branch: string;
  private: boolean;
}

interface GhContentFile {
  type: "file" | "dir";
  name: string;
  path: string;
  size: number;
  content?: string;
  encoding?: string;
  sha?: string;
}

export const githubAdapter: GitProviderAdapter = {
  provider: GitProvider.GITHUB,

  getAuthorizeUrl(redirectUri: string, state: string): string {
    const creds = credentials();
    if (!creds) {
      throw new AppError("GIT_NOT_CONFIGURED", "GitHub integration is not configured", 503);
    }
    const url = new URL(OAUTH_AUTHORIZE);
    url.searchParams.set("client_id", creds.clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", SCOPES);
    url.searchParams.set("state", state);
    return url.toString();
  },

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokenResult> {
    const creds = credentials();
    if (!creds) {
      throw new AppError("GIT_NOT_CONFIGURED", "GitHub integration is not configured", 503);
    }
    const tokenRes = await fetch(OAUTH_TOKEN, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });
    const token = (await tokenRes.json()) as { access_token?: string; error?: string };
    if (!tokenRes.ok || !token.access_token) {
      throw new AppError("GIT_OAUTH_FAILED", "Failed to exchange GitHub code", 502);
    }

    let accountLogin: string | undefined;
    try {
      const user = await ghFetch<{ login: string }>(`${API}/user`, token.access_token);
      accountLogin = user.login;
    } catch {
      // Non-fatal: we still have a usable token.
    }

    return { accessToken: token.access_token, accountLogin, expiresAt: null };
  },

  async getRepos(accessToken: string): Promise<GitRepoDto[]> {
    const repos = await ghFetch<GhRepo[]>(
      `${API}/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member`,
      accessToken,
    );
    return repos.map((r) => ({
      providerRepoId: String(r.id),
      name: r.name,
      fullName: r.full_name,
      url: r.html_url,
      defaultBranch: r.default_branch,
      isPrivate: r.private,
    }));
  },

  async getRepoFiles(
    accessToken: string,
    repo: RepoRef,
    path: string,
    branch: string,
  ): Promise<GitFileEntry[]> {
    const entries = await ghFetch<GhContentFile[] | GhContentFile>(
      `${API}/repos/${repo.fullName}/contents/${encodeURI(path)}?ref=${encodeURIComponent(branch)}`,
      accessToken,
    );
    const list = Array.isArray(entries) ? entries : [entries];
    return list.map((e) => ({
      name: e.name,
      path: e.path,
      type: e.type === "dir" ? "dir" : "file",
      size: e.size,
    }));
  },

  async getFileContent(
    accessToken: string,
    repo: RepoRef,
    path: string,
    branch: string,
  ): Promise<string> {
    const file = await ghFetch<GhContentFile>(
      `${API}/repos/${repo.fullName}/contents/${encodeURI(path)}?ref=${encodeURIComponent(branch)}`,
      accessToken,
    );
    if (file.content && file.encoding === "base64") {
      return Buffer.from(file.content, "base64").toString("utf8");
    }
    return "";
  },

  async getCommits(
    accessToken: string,
    repo: RepoRef,
    branch: string,
  ): Promise<GitCommitDto[]> {
    interface GhCommit {
      sha: string;
      html_url: string;
      commit: { message: string; author: { name: string; date: string } };
    }
    const commits = await ghFetch<GhCommit[]>(
      `${API}/repos/${repo.fullName}/commits?sha=${encodeURIComponent(branch)}&per_page=30`,
      accessToken,
    );
    return commits.map((c) => ({
      sha: c.sha,
      message: c.commit.message,
      author: c.commit.author?.name ?? "unknown",
      authoredAt: c.commit.author?.date ?? "",
      url: c.html_url,
    }));
  },

  async getPullRequests(
    accessToken: string,
    repo: RepoRef,
    state: PrState,
  ): Promise<GitPullRequestDto[]> {
    interface GhPr {
      number: number;
      title: string;
      state: string;
      html_url: string;
      head: { ref: string };
      base: { ref: string };
    }
    const prs = await ghFetch<GhPr[]>(
      `${API}/repos/${repo.fullName}/pulls?state=${state}&per_page=50`,
      accessToken,
    );
    return prs.map((p) => ({
      number: p.number,
      title: p.title,
      state: p.state,
      url: p.html_url,
      head: p.head.ref,
      base: p.base.ref,
    }));
  },

  async getIssues(
    accessToken: string,
    repo: RepoRef,
    state: PrState,
  ): Promise<GitIssueDto[]> {
    interface GhIssue {
      number: number;
      title: string;
      state: string;
      html_url: string;
      pull_request?: unknown;
    }
    const issues = await ghFetch<GhIssue[]>(
      `${API}/repos/${repo.fullName}/issues?state=${state}&per_page=50`,
      accessToken,
    );
    // GitHub returns PRs in the issues list; drop them.
    return issues
      .filter((i) => !i.pull_request)
      .map((i) => ({ number: i.number, title: i.title, state: i.state, url: i.html_url }));
  },

  async getBranchSha(accessToken: string, repo: RepoRef, branch: string): Promise<string> {
    const ref = await ghFetch<{ object: { sha: string } }>(
      `${API}/repos/${repo.fullName}/git/ref/heads/${encodeURIComponent(branch)}`,
      accessToken,
    );
    return ref.object.sha;
  },

  async createBranch(
    accessToken: string,
    repo: RepoRef,
    newBranch: string,
    fromSha: string,
  ): Promise<void> {
    await ghFetch(`${API}/repos/${repo.fullName}/git/refs`, accessToken, {
      method: "POST",
      body: JSON.stringify({ ref: `refs/heads/${newBranch}`, sha: fromSha }),
    });
  },

  async commitFile(
    accessToken: string,
    repo: RepoRef,
    branch: string,
    path: string,
    content: string,
    message: string,
  ): Promise<GitCommitDto> {
    // Look up the existing file sha (required to update; absent means create).
    let sha: string | undefined;
    try {
      const existing = await ghFetch<GhContentFile>(
        `${API}/repos/${repo.fullName}/contents/${encodeURI(path)}?ref=${encodeURIComponent(branch)}`,
        accessToken,
      );
      sha = existing.sha;
    } catch {
      sha = undefined;
    }

    const result = await ghFetch<{
      commit: { sha: string; html_url: string; message?: string };
    }>(`${API}/repos/${repo.fullName}/contents/${encodeURI(path)}`, accessToken, {
      method: "PUT",
      body: JSON.stringify({
        message,
        content: Buffer.from(content, "utf8").toString("base64"),
        branch,
        ...(sha ? { sha } : {}),
      }),
    });

    return {
      sha: result.commit.sha,
      message,
      author: "devcollab",
      authoredAt: new Date().toISOString(),
      url: result.commit.html_url,
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
    const pr = await ghFetch<{
      number: number;
      title: string;
      state: string;
      html_url: string;
      head: { ref: string };
      base: { ref: string };
    }>(`${API}/repos/${repo.fullName}/pulls`, accessToken, {
      method: "POST",
      body: JSON.stringify({ title, body, head, base }),
    });
    return {
      number: pr.number,
      title: pr.title,
      state: pr.state,
      url: pr.html_url,
      head: pr.head.ref,
      base: pr.base.ref,
    };
  },

  async createIssue(
    accessToken: string,
    repo: RepoRef,
    title: string,
    body: string,
  ): Promise<GitIssueDto> {
    const issue = await ghFetch<{
      number: number;
      title: string;
      state: string;
      html_url: string;
    }>(`${API}/repos/${repo.fullName}/issues`, accessToken, {
      method: "POST",
      body: JSON.stringify({ title, body }),
    });
    return { number: issue.number, title: issue.title, state: issue.state, url: issue.html_url };
  },
};
