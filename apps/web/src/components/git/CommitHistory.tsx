"use client";

import { ExternalLink, GitCommitHorizontal } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { useCommits } from "@/hooks/useGit";

interface CommitHistoryProps {
  roomId: string;
  branch?: string;
}

function relativeTime(iso: string): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function CommitHistory({ roomId, branch }: CommitHistoryProps) {
  const { commits, isLoading, isError } = useCommits(roomId, branch);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        Could not load commit history.
      </p>
    );
  }

  if (commits.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        No commits yet.
      </p>
    );
  }

  return (
    <ul className="flex flex-col">
      {commits.map((commit) => (
        <li key={commit.sha} className="flex gap-3 border-l border-border pl-3">
          <div className="flex flex-col items-center">
            <GitCommitHorizontal className="size-4 text-muted-foreground" />
            <span className="my-1 w-px flex-1 bg-border" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col pb-3">
            <span className="truncate text-sm">
              {commit.message.split("\n")[0]}
            </span>
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono">{commit.sha.slice(0, 7)}</span>
              <span>·</span>
              <span className="truncate">{commit.author}</span>
              <span>·</span>
              <span>{relativeTime(commit.authoredAt)}</span>
              <a
                href={commit.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground"
                aria-label="Open commit"
              >
                <ExternalLink className="size-3" />
              </a>
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
