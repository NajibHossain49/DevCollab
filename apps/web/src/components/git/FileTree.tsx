"use client";

import { ChevronRight, File, Folder, Loader2 } from "lucide-react";
import { useState } from "react";

import { gitApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRepoFiles } from "@/hooks/useGit";

interface FileTreeProps {
  repoId: string;
  branch?: string;
}

// A simple, single-level file explorer with breadcrumb navigation and a file
// content preview. Directories are navigated by replacing the current path.
export function FileTree({ repoId, branch }: FileTreeProps) {
  const [path, setPath] = useState("");
  const { files, isLoading, isError } = useRepoFiles(repoId, path, branch);

  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [content, setContent] = useState<string>("");
  const [loadingContent, setLoadingContent] = useState(false);

  const segments = path ? path.split("/").filter(Boolean) : [];

  const openFile = async (filePath: string): Promise<void> => {
    setSelectedFile(filePath);
    setLoadingContent(true);
    try {
      const res = await gitApi.content(repoId, filePath, branch);
      setContent(res.data?.content ?? "");
    } catch {
      setContent("// Failed to load file");
    } finally {
      setLoadingContent(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Breadcrumb */}
      <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        <button
          type="button"
          className="hover:text-foreground"
          onClick={() => setPath("")}
        >
          root
        </button>
        {segments.map((seg, i) => {
          const segPath = segments.slice(0, i + 1).join("/");
          return (
            <span key={segPath} className="flex items-center gap-1">
              <ChevronRight className="size-3" />
              <button
                type="button"
                className="hover:text-foreground"
                onClick={() => setPath(segPath)}
              >
                {seg}
              </button>
            </span>
          );
        })}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-1.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-full" />
          ))}
        </div>
      ) : isError ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          Could not load files for this branch.
        </p>
      ) : (
        <ul className="flex max-h-56 flex-col overflow-y-auto">
          {files
            .slice()
            .sort((a, b) => {
              if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
              return a.name.localeCompare(b.name);
            })
            .map((entry) => (
              <li key={entry.path}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-sm hover:bg-accent"
                  onClick={() =>
                    entry.type === "dir" ? setPath(entry.path) : void openFile(entry.path)
                  }
                >
                  {entry.type === "dir" ? (
                    <Folder className="size-4 text-muted-foreground" />
                  ) : (
                    <File className="size-4 text-muted-foreground" />
                  )}
                  <span className="truncate">{entry.name}</span>
                </button>
              </li>
            ))}
        </ul>
      )}

      {/* File preview */}
      {selectedFile ? (
        <div className="mt-1 flex flex-col gap-1 rounded-lg border border-border">
          <div className="flex items-center justify-between border-b border-border px-2 py-1">
            <span className="truncate text-xs font-medium">{selectedFile}</span>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs"
              onClick={() => setSelectedFile(null)}
            >
              Close
            </Button>
          </div>
          {loadingContent ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <pre className="max-h-56 overflow-auto p-2 text-xs">
              <code>{content}</code>
            </pre>
          )}
        </div>
      ) : null}
    </div>
  );
}
