"use client";

import { CheckCircle2, Play, Trash2, X, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { ApiError, executeApi } from "@/lib/api";
import { cn, formatRelativeTime } from "@/lib/utils";
import { useEditorStore } from "@/stores/editor.store";
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/types";

interface ExecutionPanelProps {
  roomId: string;
  /** Whether the current user may clear the room's run history (owner only). */
  canClearHistory?: boolean;
}

export function ExecutionPanel({
  roomId,
  canClearHistory = false,
}: ExecutionPanelProps) {
  const language = useEditorStore((s) => s.language);
  const setLanguage = useEditorStore((s) => s.setLanguage);
  const currentCode = useEditorStore((s) => s.currentCode);

  const isExecuting = useEditorStore((s) => s.isExecuting);
  const output = useEditorStore((s) => s.executionOutput);
  const error = useEditorStore((s) => s.executionError);
  const history = useEditorStore((s) => s.executionHistory);

  const setExecuting = useEditorStore((s) => s.setExecuting);
  const setExecutionResult = useEditorStore((s) => s.setExecutionResult);
  const addExecution = useEditorStore((s) => s.addExecution);
  const setExecutionHistory = useEditorStore((s) => s.setExecutionHistory);
  const clearExecutionOutput = useEditorStore((s) => s.clearExecutionOutput);
  const clearExecutionHistory = useEditorStore((s) => s.clearExecutionHistory);

  const [clearingHistory, setClearingHistory] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    executeApi
      .history(roomId, { limit: 20 })
      .then((res) => {
        if (!cancelled) setExecutionHistory(res.items);
      })
      .catch(() => {
        // Non-fatal: history is best-effort.
      });
    return () => {
      cancelled = true;
    };
  }, [roomId, setExecutionHistory]);

  const handleRun = async (): Promise<void> => {
    if (isExecuting || !currentCode.trim()) return;
    setExecuting(true);
    setExecutionResult({ output: null, error: null });

    try {
      const res = await executeApi.run({ roomId, code: currentCode, language });
      const execution = res.data?.execution;
      if (execution) {
        setExecutionResult({
          output: execution.output,
          error: execution.error,
        });
        addExecution(execution);
      }
    } catch (err) {
      setExecutionResult({
        output: null,
        error:
          err instanceof ApiError
            ? err.message
            : "Failed to run code. Please try again.",
      });
    } finally {
      setExecuting(false);
    }
  };

  const handleClearHistory = async (): Promise<void> => {
    if (clearingHistory || history.length === 0) return;
    setClearingHistory(true);
    setClearError(null);
    try {
      await executeApi.clearHistory(roomId);
      clearExecutionHistory();
    } catch (err) {
      setClearError(
        err instanceof ApiError
          ? err.message
          : "Failed to clear history. Please try again.",
      );
    } finally {
      setClearingHistory(false);
    }
  };

  const hasOutput = output !== null || error !== null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border p-3">
        <Select
          value={language}
          onChange={(event) =>
            setLanguage(event.target.value as SupportedLanguage)
          }
          aria-label="Execution language"
          className="h-8 w-36"
        >
          {SUPPORTED_LANGUAGES.map((lang) => (
            <option key={lang.value} value={lang.value}>
              {lang.label}
            </option>
          ))}
        </Select>
        <Button
          size="sm"
          className="ml-auto"
          onClick={handleRun}
          disabled={isExecuting || !currentCode.trim()}
        >
          {isExecuting ? (
            <Spinner className="text-primary-foreground" />
          ) : (
            <Play />
          )}
          Run
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
        <section>
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Output
            </h3>
            {hasOutput && !isExecuting ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 px-2 text-xs text-muted-foreground"
                onClick={clearExecutionOutput}
              >
                <X className="size-3.5" />
                Clear
              </Button>
            ) : null}
          </div>
          <pre className="min-h-16 whitespace-pre-wrap break-words rounded-md bg-muted/60 p-3 font-mono text-xs">
            {isExecuting ? "Running…" : (output ?? "—")}
          </pre>
          {error ? (
            <pre className="mt-2 whitespace-pre-wrap break-words rounded-md bg-destructive/10 p-3 font-mono text-xs text-destructive">
              {error}
            </pre>
          ) : null}
        </section>

        <section>
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              History
            </h3>
            {canClearHistory && history.length > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 px-2 text-xs text-muted-foreground hover:text-destructive"
                onClick={handleClearHistory}
                disabled={clearingHistory}
              >
                {clearingHistory ? (
                  <Spinner className="size-3.5" />
                ) : (
                  <Trash2 className="size-3.5" />
                )}
                Clear
              </Button>
            ) : null}
          </div>
          {clearError ? (
            <p className="mb-1 text-xs text-destructive">{clearError}</p>
          ) : null}
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No runs yet.</p>
          ) : (
            <ul className="space-y-1">
              {history.map((execution) => {
                const failed =
                  execution.status === "ERROR" ||
                  execution.status === "TIMEOUT";
                return (
                  <li
                    key={execution.id}
                    className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-xs"
                  >
                    {failed ? (
                      <XCircle className="size-3.5 text-destructive" />
                    ) : (
                      <CheckCircle2 className="size-3.5 text-emerald-500" />
                    )}
                    <Badge variant="secondary" className="shrink-0">
                      {execution.language}
                    </Badge>
                    <span
                      className={cn(
                        "truncate",
                        failed ? "text-destructive" : "text-muted-foreground",
                      )}
                    >
                      {execution.status}
                    </span>
                    <span className="ml-auto shrink-0 text-muted-foreground">
                      {formatRelativeTime(execution.createdAt)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
