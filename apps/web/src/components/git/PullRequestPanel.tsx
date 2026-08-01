"use client";

import { ExternalLink, GitPullRequest, Loader2, Plus } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useCreatePullRequest, usePullRequests } from "@/hooks/useGit";
import type { GitListState } from "@/types";

interface PullRequestPanelProps {
  roomId: string;
}

function stateVariant(state: string): "default" | "secondary" | "outline" {
  const s = state.toLowerCase();
  if (s.includes("merge")) return "default";
  if (s.includes("close") || s.includes("declin")) return "secondary";
  return "outline";
}

export function PullRequestPanel({ roomId }: PullRequestPanelProps) {
  const [filter, setFilter] = useState<GitListState>("open");
  const { pullRequests, isLoading, isError } = usePullRequests(roomId, filter);
  const createPr = useCreatePullRequest();

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (): void => {
    setError(null);
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    createPr.mutate(
      { roomId, title: title.trim(), description: description.trim() || undefined },
      {
        onSuccess: () => {
          setTitle("");
          setDescription("");
          setShowForm(false);
        },
        onError: (e) => setError(e instanceof Error ? e.message : "Failed to open PR"),
      },
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {(["open", "closed", "all"] as GitListState[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              className={`rounded px-2 py-1 text-xs capitalize ${
                filter === s
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowForm((v) => !v)}>
          <Plus className="size-3.5" /> New PR
        </Button>
      </div>

      {showForm ? (
        <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <Input
            placeholder="Pull request title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Textarea
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <p className="text-xs text-muted-foreground">
            This creates a branch from the room&apos;s code and opens a PR on the
            linked repository.
          </p>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={submit} disabled={createPr.isPending}>
              {createPr.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Create PR"
              )}
            </Button>
          </div>
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : isError ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          Could not load pull requests.
        </p>
      ) : pullRequests.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          No {filter === "all" ? "" : filter} pull requests.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {pullRequests.map((pr) => (
            <li
              key={pr.number}
              className="flex items-start justify-between gap-2 rounded-lg border border-border p-2.5"
            >
              <div className="flex min-w-0 gap-2">
                <GitPullRequest className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">{pr.title}</span>
                  <span className="text-xs text-muted-foreground">
                    #{pr.number} · {pr.head} → {pr.base}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Badge variant={stateVariant(pr.state)}>{pr.state}</Badge>
                <a
                  href={pr.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Open pull request"
                >
                  <ExternalLink className="size-3.5" />
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
