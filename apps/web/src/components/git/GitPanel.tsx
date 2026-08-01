"use client";

import {
  ArrowDownToLine,
  ArrowUpFromLine,
  GitBranch,
  Loader2,
  Plug,
  RefreshCw,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useGitProviders, useGitRepos, useGitSync } from "@/hooks/useGit";
import { useGitEvents } from "@/hooks/useGitEvents";

import { CodeReviewPanel } from "./CodeReviewPanel";
import { CommitHistory } from "./CommitHistory";
import { FileTree } from "./FileTree";
import { GitConnectModal } from "./GitConnectModal";
import { IssueTracker } from "./IssueTracker";
import { PullRequestPanel } from "./PullRequestPanel";
import { RepoSelector } from "./RepoSelector";

type GitTab = "sync" | "files" | "prs" | "commits" | "issues" | "review";

const GIT_TABS: { id: GitTab; label: string }[] = [
  { id: "sync", label: "Sync" },
  { id: "files", label: "Files" },
  { id: "prs", label: "PRs" },
  { id: "commits", label: "Commits" },
  { id: "issues", label: "Issues" },
  { id: "review", label: "Review" },
];

interface GitPanelProps {
  roomId: string;
}

export function GitPanel({ roomId }: GitPanelProps) {
  const { integrations, isLoading: providersLoading } = useGitProviders();
  const { repos, isLoading: reposLoading, refetch } = useGitRepos(undefined, integrations.length > 0);
  const events = useGitEvents(roomId);

  const [connectOpen, setConnectOpen] = useState(false);
  const [tab, setTab] = useState<GitTab>("sync");

  const linkedRepo = useMemo(
    () => repos.find((r) => r.linkedRoomId === roomId) ?? null,
    [repos, roomId],
  );

  const hasIntegration = integrations.length > 0;

  if (providersLoading) {
    return (
      <div className="flex flex-col gap-2 p-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  // Not connected to any provider yet.
  if (!hasIntegration) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <GitBranch className="size-8 text-muted-foreground" />
        <div>
          <p className="font-medium">Connect a Git provider</p>
          <p className="text-sm text-muted-foreground">
            Sync code, open pull requests, and track issues from this room.
          </p>
        </div>
        <Button onClick={() => setConnectOpen(true)}>
          <Plug className="size-4" /> Connect
        </Button>
        <GitConnectModal open={connectOpen} onOpenChange={setConnectOpen} />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <GitBranch className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm font-medium">
            {linkedRepo ? linkedRepo.fullName : "No repository linked"}
          </span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setConnectOpen(true)}
          className="shrink-0"
        >
          <Plug className="size-3.5" /> Manage
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {/* Live activity */}
        {events.length > 0 ? (
          <div className="mb-3 rounded-lg border border-border bg-muted/30 p-2 text-xs">
            <span className="font-medium">Live:</span>{" "}
            {events[0]?.message}
          </div>
        ) : null}

        {!linkedRepo ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Link a repository to this room to enable sync, pull requests, and
              issue tracking.
            </p>
            <RepoSelector roomId={roomId} linkedRepoId={null} onLinked={() => void refetch()} />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Sub-tabs */}
            <div className="flex flex-wrap gap-1">
              {GIT_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                    tab === t.id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {reposLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : tab === "sync" ? (
              <SyncTab
                roomId={roomId}
                repoId={linkedRepo.id}
                defaultBranch={linkedRepo.defaultBranch}
              />
            ) : tab === "files" ? (
              <FileTree repoId={linkedRepo.id} branch={linkedRepo.defaultBranch} />
            ) : tab === "prs" ? (
              <PullRequestPanel roomId={roomId} />
            ) : tab === "commits" ? (
              <CommitHistory roomId={roomId} branch={linkedRepo.defaultBranch} />
            ) : tab === "issues" ? (
              <IssueTracker roomId={roomId} />
            ) : (
              <CodeReviewPanel repoId={linkedRepo.id} branch={linkedRepo.defaultBranch} />
            )}
          </div>
        )}
      </div>

      <GitConnectModal open={connectOpen} onOpenChange={setConnectOpen} />
    </div>
  );
}

function SyncTab({
  roomId,
  repoId,
  defaultBranch,
}: {
  roomId: string;
  repoId: string;
  defaultBranch: string;
}) {
  const sync = useGitSync();
  const [branch, setBranch] = useState(defaultBranch);
  const [commitMessage, setCommitMessage] = useState("");
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);

  const run = (direction: "toRepo" | "toRoom"): void => {
    setStatus(null);
    sync.mutate(
      {
        repoId,
        roomId,
        direction,
        branch: branch.trim() || undefined,
        commitMessage: commitMessage.trim() || undefined,
      },
      {
        onSuccess: () =>
          setStatus({
            ok: true,
            message:
              direction === "toRepo"
                ? "Pushed room code to the repository."
                : "Pulled repository code into the room.",
          }),
        onError: (e) =>
          setStatus({
            ok: false,
            message: e instanceof Error ? e.message : "Sync failed",
          }),
      },
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">Branch</label>
        <Input
          value={branch}
          onChange={(e) => setBranch(e.target.value)}
          placeholder={defaultBranch}
          className="h-8"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          Commit message (optional)
        </label>
        <Input
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          placeholder="DevCollab sync"
          className="h-8"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Button
          onClick={() => run("toRepo")}
          disabled={sync.isPending}
          className="justify-start"
        >
          {sync.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ArrowUpFromLine className="size-4" />
          )}
          Push room → repo
        </Button>
        <Button
          variant="outline"
          onClick={() => run("toRoom")}
          disabled={sync.isPending}
          className="justify-start"
        >
          {sync.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ArrowDownToLine className="size-4" />
          )}
          Pull repo → room
        </Button>
      </div>

      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <RefreshCw className="mt-0.5 size-3 shrink-0" />
        The room&apos;s shared buffer syncs to a single file
        (<code>devcollab/&lt;room&gt;.&lt;ext&gt;</code>) on the selected branch.
      </p>

      {status ? (
        <p
          className={`text-xs ${status.ok ? "text-green-600 dark:text-green-400" : "text-destructive"}`}
        >
          {status.message}
        </p>
      ) : null}
    </div>
  );
}
