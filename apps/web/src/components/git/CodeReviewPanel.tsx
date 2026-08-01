"use client";

import { MessageSquarePlus, Search } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { gitApi } from "@/lib/api";

interface CodeReviewPanelProps {
  repoId: string;
  branch?: string;
}

interface ReviewComment {
  line: number;
  text: string;
}

// A minimal inline code-review surface: load a file, then attach review notes to
// individual lines. Comments are kept locally so reviewers can draft feedback
// before sharing it (e.g. as an issue or PR comment).
export function CodeReviewPanel({ repoId, branch }: CodeReviewPanelProps) {
  const [path, setPath] = useState("");
  const [lines, setLines] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [activeLine, setActiveLine] = useState<number | null>(null);
  const [draft, setDraft] = useState("");

  const load = async (): Promise<void> => {
    if (!path.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await gitApi.content(repoId, path.trim(), branch);
      setLines((res.data?.content ?? "").split("\n"));
      setComments([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load file");
      setLines(null);
    } finally {
      setLoading(false);
    }
  };

  const addComment = (line: number): void => {
    if (!draft.trim()) {
      setActiveLine(null);
      return;
    }
    setComments((prev) => [...prev, { line, text: draft.trim() }]);
    setDraft("");
    setActiveLine(null);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Path to review, e.g. src/index.ts"
          value={path}
          onChange={(e) => setPath(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void load();
          }}
          className="h-8"
        />
        <Button
          size="icon"
          variant="outline"
          className="h-8 w-8 shrink-0"
          onClick={() => void load()}
          disabled={loading}
          aria-label="Load file"
        >
          <Search className="size-4" />
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      ) : error ? (
        <p className="py-4 text-center text-sm text-muted-foreground">{error}</p>
      ) : lines ? (
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="max-h-72 overflow-auto font-mono text-xs">
            {lines.map((line, i) => {
              const lineNo = i + 1;
              const lineComments = comments.filter((c) => c.line === lineNo);
              return (
                <div key={lineNo} className="group">
                  <div className="flex items-start hover:bg-accent/50">
                    <span className="w-10 shrink-0 select-none px-2 py-0.5 text-right text-muted-foreground">
                      {lineNo}
                    </span>
                    <button
                      type="button"
                      className="mt-0.5 shrink-0 px-1 text-muted-foreground opacity-0 group-hover:opacity-100"
                      onClick={() => setActiveLine(lineNo)}
                      aria-label={`Comment on line ${lineNo}`}
                    >
                      <MessageSquarePlus className="size-3" />
                    </button>
                    <pre className="flex-1 whitespace-pre-wrap break-all px-1 py-0.5">
                      {line || " "}
                    </pre>
                  </div>

                  {lineComments.map((c, idx) => (
                    <div
                      key={idx}
                      className="ml-10 border-l-2 border-primary bg-muted/50 px-2 py-1 text-[11px]"
                    >
                      {c.text}
                    </div>
                  ))}

                  {activeLine === lineNo ? (
                    <div className="ml-10 flex flex-col gap-1 bg-muted/50 p-2">
                      <Input
                        autoFocus
                        placeholder="Add a review comment…"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") addComment(lineNo);
                          if (e.key === "Escape") setActiveLine(null);
                        }}
                        className="h-7 text-xs"
                      />
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-xs"
                          onClick={() => setActiveLine(null)}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() => addComment(lineNo)}
                        >
                          Comment
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="py-4 text-center text-sm text-muted-foreground">
          Enter a file path to start a review.
        </p>
      )}

      {comments.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          {comments.length} review comment{comments.length === 1 ? "" : "s"} drafted.
        </p>
      ) : null}
    </div>
  );
}
