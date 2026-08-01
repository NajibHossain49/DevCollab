"use client";

import { Check, Link2, Lock, RefreshCw } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useGitRepos, useLinkRepo } from "@/hooks/useGit";
import type { GitRepo } from "@/types";

interface RepoSelectorProps {
  roomId: string;
  linkedRepoId: string | null;
  onLinked?: (repo: GitRepo) => void;
}

export function RepoSelector({ roomId, linkedRepoId, onLinked }: RepoSelectorProps) {
  const { repos, isLoading, isFetching, refetch } = useGitRepos();
  const link = useLinkRepo();
  const [filter, setFilter] = useState("");

  const filtered = repos.filter((r) =>
    r.fullName.toLowerCase().includes(filter.toLowerCase()),
  );

  const handleLink = (repo: GitRepo): void => {
    link.mutate(
      { repoId: repo.id, roomId },
      { onSuccess: () => onLinked?.(repo) },
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Filter repositories…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="h-8"
        />
        <Button
          size="icon"
          variant="outline"
          className="h-8 w-8 shrink-0"
          onClick={() => void refetch()}
          disabled={isFetching}
          aria-label="Refresh repositories"
        >
          <RefreshCw className={isFetching ? "animate-spin" : ""} />
        </Button>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No repositories found. Connect a provider first.
        </p>
      ) : (
        <ul className="flex max-h-72 flex-col gap-1.5 overflow-y-auto">
          {filtered.map((repo) => {
            const isLinked = repo.id === linkedRepoId;
            return (
              <li
                key={repo.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border p-2.5"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="flex items-center gap-1.5 truncate text-sm font-medium">
                    {repo.fullName}
                    {repo.isPrivate ? (
                      <Lock className="size-3 text-muted-foreground" />
                    ) : null}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {repo.provider} · {repo.defaultBranch}
                  </span>
                </div>
                {isLinked ? (
                  <Badge variant="secondary" className="gap-1 shrink-0">
                    <Check className="size-3" /> Linked
                  </Badge>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    disabled={link.isPending}
                    onClick={() => handleLink(repo)}
                  >
                    <Link2 className="size-3.5" /> Link
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
