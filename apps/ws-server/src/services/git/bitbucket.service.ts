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

const API = "https://api.bitbucket.org/2.0";
const OAUTH_AUTHORIZE = "https://bitbucket.org/site/oauth2/authorize";
const OAUTH_TOKEN = "https://bitbucket.org/site/oauth2/access_token";

function credentials(): { clientId: string; clientSecret: string } | null {
  if (!env.BITBUCKET_CLIENT_ID || !env.BITBUCKET_CLIENT_SECRET) {
    return null;
  }
  return { clientId: env.BITBUCKET_CLIENT_ID, clientSecret: env.BITBUCKET_CLIENT_SECRET };
}

async function bbFetch<T>(
  url: string,
  accessToken: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new AppError(
      "GIT_PROVIDER_ERROR",
      `Bitbucket API ${response.status}: ${detail.slice(0, 300)}`,
      response.status === 404 ? 404 : 502,
    );
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

function mapPrState(state: PrState): string | null {
  if (state === "open") return "OPEN";
  if (state === "closed") return "MERGED";
  return null; // "all": omit to use provider default
}

export const bitbucketAdapter: GitProviderAdapter = {
  provider: GitProvider.BITBUCKET,

  getAuthorizeUrl(_redirectUri: string, state: string): string {
    const creds = credentials();
    if (!creds) {
      throw new AppError("GIT_NOT_CONFIGURED", "Bitbucket integration is not configured", 503);
    }
    // Bitbucket takes the redirect URI from the OAuth consumer config, not the
    // request, so it is intentionally omitted here.
    const url = new URL(OAUTH_AUTHORIZE);
    url.searchParams.set("client_id", creds.clientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("state", state);
    return url.toString();
  },

  async exchangeCode(code: string, _redirectUri: string): Promise<OAuthTokenResult> {
    const creds = credentials();
    if (!creds) {
      throw new AppError("GIT_NOT_CONFIGURED", "Bitbucket integration is not configured", 503);
    }
    const basic = Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString("base64");
    const res = await fetch(OAUTH_TOKEN, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ grant_type: "authorization_code", code }).toString(),
    });
    const token = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };
    if (!res.ok || !token.access_token) {
      throw new AppError("GIT_OAUTH_FAILED", "Failed to exchange Bitbucket code", 502);
    }

    let accountLogin: string | undefined;
    try {
      const user = await bbFetch<{ username?: string; nickname?: string }>(
        `${API}/user`,
        token.access_token,
      );
      accountLogin = user.username ?? user.nickname;
    } catch {
      // Non-fatal (requires the account scope).
    }

    return {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      accountLogin,
      expiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null,
    };
  },

  async getRepos(accessToken: string): Promise<GitRepoDto[]> {
    interface BbRepo {
      uuid: string;
      name: string;
      full_name: string;
      is_private: boolean;
      mainbranch?: { name: string };
      links: { html: { href: string } };
    }
    const data = await bbFetch<{ values: BbRepo[] }>(
      `${API}/repositories?role=member&pagelen=100&sort=-updated_on`,
      accessToken,
    );
    return data.values.map((r) => ({
      providerRepoId: r.uuid,
      name: r.name,
      fullName: r.full_name,
      url: r.links.html.href,
      defaultBranch: r.mainbranch?.name ?? "main",
      isPrivate: r.is_private,
    }));
  },

  async getRepoFiles(
    accessToken: string,
    repo: RepoRef,
    path: string,
    branch: string,
  ): Promise<GitFileEntry[]> {
    interface BbSrc {
      path: string;
      type: "commit_file" | "commit_directory";
    }
    const cleanPath = path ? `${path.replace(/\/$/, "")}/` : "";
    const data = await bbFetch<{ values: BbSrc[] }>(
      `${API}/repositories/${repo.fullName}/src/${encodeURIComponent(branch)}/${encodeURI(cleanPath)}?pagelen=100`,
      accessToken,
    );
    return data.values.map((e) => ({
      name: e.path.split("/").filter(Boolean).pop() ?? e.path,
      path: e.path,
      type: e.type === "commit_directory" ? "dir" : "file",
    }));
  },

  async getFileContent(
    accessToken: string,
    repo: RepoRef,
    path: string,
    branch: string,
  ): Promise<string> {
    const res = await fetch(
      `${API}/repositories/${repo.fullName}/src/${encodeURIComponent(branch)}/${encodeURI(path)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) {
      throw new AppError("GIT_PROVIDER_ERROR", `Bitbucket file fetch ${res.status}`, 502);
    }
    return res.text();
  },

  async getCommits(
    accessToken: string,
    repo: RepoRef,
    branch: string,
  ): Promise<GitCommitDto[]> {
    interface BbCommit {
      hash: string;
      message: string;
      date: string;
      author: { raw?: string; user?: { display_name?: string } };
      links: { html: { href: string } };
    }
    const data = await bbFetch<{ values: BbCommit[] }>(
      `${API}/repositories/${repo.fullName}/commits/${encodeURIComponent(branch)}?pagelen=30`,
      accessToken,
    );
    return data.values.map((c) => ({
      sha: c.hash,
      message: c.message,
      author: c.author.user?.display_name ?? c.author.raw ?? "unknown",
      authoredAt: c.date,
      url: c.links.html.href,
    }));
  },

  async getPullRequests(
    accessToken: string,
    repo: RepoRef,
    state: PrState,
  ): Promise<GitPullRequestDto[]> {
    interface BbPr {
      id: number;
      title: string;
      state: string;
      links: { html: { href: string } };
      source: { branch: { name: string } };
      destination: { branch: { name: string } };
    }
    const mapped = mapPrState(state);
    const query = mapped ? `?state=${mapped}&pagelen=50` : "?pagelen=50";
    const data = await bbFetch<{ values: BbPr[] }>(
      `${API}/repositories/${repo.fullName}/pullrequests${query}`,
      accessToken,
    );
    return data.values.map((p) => ({
      number: p.id,
      title: p.title,
      state: p.state,
      url: p.links.html.href,
      head: p.source.branch.name,
      base: p.destination.branch.name,
    }));
  },

  async getIssues(
    accessToken: string,
    repo: RepoRef,
    _state: PrState,
  ): Promise<GitIssueDto[]> {
    interface BbIssue {
      id: number;
      title: string;
      state: string;
      links: { html: { href: string } };
    }
    const data = await bbFetch<{ values: BbIssue[] }>(
      `${API}/repositories/${repo.fullName}/issues?pagelen=50`,
      accessToken,
    );
    return data.values.map((i) => ({
      number: i.id,
      title: i.title,
      state: i.state,
      url: i.links.html.href,
    }));
  },

  async getBranchSha(accessToken: string, repo: RepoRef, branch: string): Promise<string> {
    const b = await bbFetch<{ target: { hash: string } }>(
      `${API}/repositories/${repo.fullName}/refs/branches/${encodeURIComponent(branch)}`,
      accessToken,
    );
    return b.target.hash;
  },

  async createBranch(
    accessToken: string,
    repo: RepoRef,
    newBranch: string,
    fromSha: string,
  ): Promise<void> {
    await bbFetch(`${API}/repositories/${repo.fullName}/refs/branches`, accessToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newBranch, target: { hash: fromSha } }),
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
    // Bitbucket's src endpoint takes form fields: <file path>=<content>.
    const form = new URLSearchParams();
    form.set(path, content);
    form.set("message", message);
    form.set("branch", branch);

    const res = await fetch(`${API}/repositories/${repo.fullName}/src`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new AppError(
        "GIT_PROVIDER_ERROR",
        `Bitbucket commit ${res.status}: ${detail.slice(0, 200)}`,
        502,
      );
    }

    // The src endpoint returns 201 with no useful body; report the tip commit.
    let sha = "";
    let url = "";
    try {
      const tip = await this.getCommits(accessToken, repo, branch);
      sha = tip[0]?.sha ?? "";
      url = tip[0]?.url ?? "";
    } catch {
      // ignore
    }
    return {
      sha,
      message,
      author: "devcollab",
      authoredAt: new Date().toISOString(),
      url,
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
    const pr = await bbFetch<{
      id: number;
      title: string;
      state: string;
      links: { html: { href: string } };
      source: { branch: { name: string } };
      destination: { branch: { name: string } };
    }>(`${API}/repositories/${repo.fullName}/pullrequests`, accessToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description: body,
        source: { branch: { name: head } },
        destination: { branch: { name: base } },
      }),
    });
    return {
      number: pr.id,
      title: pr.title,
      state: pr.state,
      url: pr.links.html.href,
      head: pr.source.branch.name,
      base: pr.destination.branch.name,
    };
  },

  async createIssue(
    accessToken: string,
    repo: RepoRef,
    title: string,
    body: string,
  ): Promise<GitIssueDto> {
    const issue = await bbFetch<{
      id: number;
      title: string;
      state: string;
      links: { html: { href: string } };
    }>(`${API}/repositories/${repo.fullName}/issues`, accessToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content: { raw: body } }),
    });
    return {
      number: issue.id,
      title: issue.title,
      state: issue.state,
      url: issue.links.html.href,
    };
  },
};
