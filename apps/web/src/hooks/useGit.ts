"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { gitApi } from "@/lib/api";
import type {
  CreatePullRequestInput,
  GitListState,
  GitProviderSlug,
  GitSyncDirection,
} from "@/types";

export const gitKeys = {
  all: ["git"] as const,
  providers: () => [...gitKeys.all, "providers"] as const,
  repos: (provider?: GitProviderSlug) => [...gitKeys.all, "repos", provider ?? "all"] as const,
  files: (repoId: string, path: string, branch?: string) =>
    [...gitKeys.all, "files", repoId, path, branch ?? "default"] as const,
  pullRequests: (roomId: string, state: GitListState) =>
    [...gitKeys.all, "prs", roomId, state] as const,
  commits: (roomId: string, branch?: string) =>
    [...gitKeys.all, "commits", roomId, branch ?? "default"] as const,
  issues: (roomId: string, state: GitListState) =>
    [...gitKeys.all, "issues", roomId, state] as const,
};

// Configured providers + the current user's connected integrations.
export function useGitProviders() {
  const query = useQuery({
    queryKey: gitKeys.providers(),
    queryFn: () => gitApi.providers(),
  });
  return {
    configured: query.data?.data?.configured ?? [],
    integrations: query.data?.data?.integrations ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}

// Kicks off the OAuth flow by fetching the authorize URL and redirecting.
export function useGitConnect() {
  return useMutation({
    mutationFn: (provider: GitProviderSlug) => gitApi.connect(provider),
    onSuccess: (res) => {
      const url = res.data?.url;
      if (url && typeof window !== "undefined") {
        window.location.href = url;
      }
    },
  });
}

export function useDisconnectGit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => gitApi.disconnect(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: gitKeys.providers() });
      void queryClient.invalidateQueries({ queryKey: [...gitKeys.all, "repos"] });
    },
  });
}

export function useGitRepos(provider?: GitProviderSlug, enabled = true) {
  const query = useQuery({
    queryKey: gitKeys.repos(provider),
    queryFn: () => gitApi.repos(provider),
    enabled,
  });
  return {
    repos: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    refetch: query.refetch,
  };
}

export function useLinkRepo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ repoId, roomId }: { repoId: string; roomId: string }) =>
      gitApi.linkRepo(repoId, roomId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...gitKeys.all, "repos"] });
    },
  });
}

export function useGitSync() {
  return useMutation({
    mutationFn: ({
      repoId,
      roomId,
      direction,
      branch,
      commitMessage,
    }: {
      repoId: string;
      roomId: string;
      direction: GitSyncDirection;
      branch?: string;
      commitMessage?: string;
    }) => gitApi.sync(repoId, { roomId, direction, branch, commitMessage }),
  });
}

export function useRepoFiles(
  repoId: string | undefined,
  path: string,
  branch?: string,
) {
  const query = useQuery({
    queryKey: gitKeys.files(repoId ?? "", path, branch),
    queryFn: () => gitApi.files(repoId as string, { path, branch }),
    enabled: Boolean(repoId),
  });
  return {
    files: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

export function usePullRequests(roomId: string, state: GitListState = "open") {
  const query = useQuery({
    queryKey: gitKeys.pullRequests(roomId, state),
    queryFn: () => gitApi.pullRequests(roomId, state),
    enabled: Boolean(roomId),
  });
  return {
    pullRequests: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}

export function useCreatePullRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePullRequestInput) => gitApi.createPullRequest(data),
    onSuccess: (_res, variables) => {
      void queryClient.invalidateQueries({
        queryKey: [...gitKeys.all, "prs", variables.roomId],
      });
    },
  });
}

export function useCommits(roomId: string, branch?: string) {
  const query = useQuery({
    queryKey: gitKeys.commits(roomId, branch),
    queryFn: () => gitApi.commits(roomId, branch),
    enabled: Boolean(roomId),
  });
  return {
    commits: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}

export function useIssues(roomId: string, state: GitListState = "open") {
  const query = useQuery({
    queryKey: gitKeys.issues(roomId, state),
    queryFn: () => gitApi.issues(roomId, state),
    enabled: Boolean(roomId),
  });
  return {
    issues: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}

export function useCreateIssue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { roomId: string; title: string; body?: string }) =>
      gitApi.createIssue(data),
    onSuccess: (_res, variables) => {
      void queryClient.invalidateQueries({
        queryKey: [...gitKeys.all, "issues", variables.roomId],
      });
    },
  });
}
