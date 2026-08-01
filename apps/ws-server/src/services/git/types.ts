import type { GitProvider } from "@prisma/client";

// ---------------------------------------------------------------------------
// Common DTOs and the provider adapter contract. Each provider (GitHub, GitLab,
// Bitbucket) implements GitProviderAdapter against its own REST API, so the
// rest of the app is provider-agnostic. All APIs used are free.
// ---------------------------------------------------------------------------

// Identifies a repo across providers: fullName ("owner/repo") is enough for
// GitHub/Bitbucket, while GitLab addresses projects by numeric id, so we carry
// both.
export interface RepoRef {
  fullName: string;
  providerId: string;
}

export interface OAuthTokenResult {
  accessToken: string;
  refreshToken?: string;
  accountLogin?: string;
  expiresAt?: Date | null;
}

export interface GitRepoDto {
  providerRepoId: string;
  name: string;
  fullName: string;
  url: string;
  defaultBranch: string;
  isPrivate: boolean;
}

export interface GitFileEntry {
  name: string;
  path: string;
  type: "file" | "dir";
  size?: number;
}

export interface GitCommitDto {
  sha: string;
  message: string;
  author: string;
  authoredAt: string;
  url: string;
}

export type PrState = "open" | "closed" | "all";

export interface GitPullRequestDto {
  number: number;
  title: string;
  state: string;
  url: string;
  head: string;
  base: string;
}

export interface GitIssueDto {
  number: number;
  title: string;
  state: string;
  url: string;
}

export interface GitProviderAdapter {
  readonly provider: GitProvider;

  // OAuth.
  getAuthorizeUrl(redirectUri: string, state: string): string;
  exchangeCode(code: string, redirectUri: string): Promise<OAuthTokenResult>;

  // Read.
  getRepos(accessToken: string): Promise<GitRepoDto[]>;
  getRepoFiles(
    accessToken: string,
    repo: RepoRef,
    path: string,
    branch: string,
  ): Promise<GitFileEntry[]>;
  getFileContent(
    accessToken: string,
    repo: RepoRef,
    path: string,
    branch: string,
  ): Promise<string>;
  getCommits(
    accessToken: string,
    repo: RepoRef,
    branch: string,
  ): Promise<GitCommitDto[]>;
  getPullRequests(
    accessToken: string,
    repo: RepoRef,
    state: PrState,
  ): Promise<GitPullRequestDto[]>;
  getIssues(
    accessToken: string,
    repo: RepoRef,
    state: PrState,
  ): Promise<GitIssueDto[]>;

  // Write.
  getBranchSha(accessToken: string, repo: RepoRef, branch: string): Promise<string>;
  createBranch(
    accessToken: string,
    repo: RepoRef,
    newBranch: string,
    fromSha: string,
  ): Promise<void>;
  // Creates or updates a single file on a branch and returns the new commit.
  commitFile(
    accessToken: string,
    repo: RepoRef,
    branch: string,
    path: string,
    content: string,
    message: string,
  ): Promise<GitCommitDto>;
  createPullRequest(
    accessToken: string,
    repo: RepoRef,
    title: string,
    body: string,
    head: string,
    base: string,
  ): Promise<GitPullRequestDto>;
  createIssue(
    accessToken: string,
    repo: RepoRef,
    title: string,
    body: string,
  ): Promise<GitIssueDto>;
}
