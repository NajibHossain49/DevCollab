"use client";

import { CircleDot, ExternalLink, Loader2, Plus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useCreateIssue, useIssues } from "@/hooks/useGit";
import type { GitListState } from "@/types";

interface IssueTrackerProps {
  roomId: string;
}

export function IssueTracker({ roomId }: IssueTrackerProps) {
  const [filter, setFilter] = useState<GitListState>("open");
  const { issues, isLoading, isError } = useIssues(roomId, filter);
  const createIssue = useCreateIssue();

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (): void => {
    setError(null);
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    createIssue.mutate(
      { roomId, title: title.trim(), body: body.trim() || undefined },
      {
        onSuccess: () => {
          setTitle("");
          setBody("");
          setShowForm(false);
        },
        onError: (e) =>
          setError(e instanceof Error ? e.message : "Failed to create issue"),
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
          <Plus className="size-3.5" /> New Issue
        </Button>
      </div>

      {showForm ? (
        <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <Input
            placeholder="Issue title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Textarea
            placeholder="Describe the issue (optional)"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
          />
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={submit} disabled={createIssue.isPending}>
              {createIssue.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Create Issue"
              )}
            </Button>
          </div>
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : isError ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          Could not load issues. The repo&apos;s issue tracker may be disabled.
        </p>
      ) : issues.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          No {filter === "all" ? "" : filter} issues.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {issues.map((issue) => (
            <li
              key={issue.number}
              className="flex items-start justify-between gap-2 rounded-lg border border-border p-2.5"
            >
              <div className="flex min-w-0 gap-2">
                <CircleDot className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">{issue.title}</span>
                  <span className="text-xs text-muted-foreground">
                    #{issue.number} · {issue.state}
                  </span>
                </div>
              </div>
              <a
                href={issue.url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-muted-foreground hover:text-foreground"
                aria-label="Open issue"
              >
                <ExternalLink className="size-3.5" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
