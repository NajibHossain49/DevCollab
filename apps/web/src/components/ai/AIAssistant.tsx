"use client";

import { Sparkles, WandSparkles } from "lucide-react";
import type {
  CancellationToken,
  editor as MonacoEditorNS,
  languages as MonacoLanguagesNS,
  Position as MonacoPosition,
} from "monaco-editor";
import { useEffect, useRef, useState } from "react";

import { useEditorInstance } from "@/components/editor/editor-context";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ApiError, aiApi } from "@/lib/api";
import { useEditorStore } from "@/stores/editor.store";

// Reads the AI completion SSE stream and accumulates the full suggestion text.
async function streamCompletion(
  body: {
    code: string;
    language: string;
    cursorPosition: { line: number; ch: number };
  },
  signal: AbortSignal,
): Promise<string> {
  const response = await aiApi.completeStream(body, signal);
  if (!response.ok || !response.body) return "";

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result = "";

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") return result;
      try {
        const parsed = JSON.parse(data) as { completion?: string };
        if (typeof parsed.completion === "string") result += parsed.completion;
      } catch {
        // Ignore keep-alive / non-JSON lines.
      }
    }
  }

  return result;
}

export function AIAssistant() {
  const { editor, monaco } = useEditorInstance();
  const language = useEditorStore((s) => s.language);
  const aiSuggestion = useEditorStore((s) => s.aiSuggestion);
  const setAiSuggestion = useEditorStore((s) => s.setAiSuggestion);

  const [explanation, setExplanation] = useState<string | null>(null);
  const [explaining, setExplaining] = useState(false);
  const [explainError, setExplainError] = useState<string | null>(null);

  const languageRef = useRef(language);
  languageRef.current = language;

  // Register the inline (ghost text) completion provider. We only call the AI
  // on an explicit trigger (Ctrl/Cmd+Space) to avoid spamming on every keypress.
  useEffect(() => {
    if (!editor || !monaco) return;

    const provider = monaco.languages.registerInlineCompletionsProvider(
      { pattern: "**" },
      {
        provideInlineCompletions: async (
          model: MonacoEditorNS.ITextModel,
          position: MonacoPosition,
          context: MonacoLanguagesNS.InlineCompletionContext,
          token: CancellationToken,
        ) => {
          if (
            context.triggerKind !==
            monaco.languages.InlineCompletionTriggerKind.Explicit
          ) {
            return { items: [] };
          }

          const controller = new AbortController();
          token.onCancellationRequested(() => controller.abort());

          try {
            const completion = await streamCompletion(
              {
                code: model.getValue(),
                language: languageRef.current,
                cursorPosition: {
                  line: position.lineNumber - 1,
                  ch: position.column - 1,
                },
              },
              controller.signal,
            );

            if (!completion) return { items: [] };
            setAiSuggestion(completion);

            return {
              items: [
                {
                  insertText: completion,
                  range: new monaco.Range(
                    position.lineNumber,
                    position.column,
                    position.lineNumber,
                    position.column,
                  ),
                },
              ],
            };
          } catch {
            return { items: [] };
          }
        },
        freeInlineCompletions: () => {
          // No provider-side resources to release.
        },
      },
    );

    // Ctrl/Cmd+Space explicitly triggers the inline suggestion.
    const command = editor.addAction({
      id: "devcollab.ai.triggerInline",
      label: "DevCollab: AI Inline Suggestion",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Space],
      run: (ed) => {
        ed.trigger("devcollab-ai", "editor.action.inlineSuggest.trigger", {});
      },
    });

    return () => {
      provider.dispose();
      command.dispose();
    };
  }, [editor, monaco, setAiSuggestion]);

  const handleExplain = async (): Promise<void> => {
    if (!editor || explaining) return;
    const model = editor.getModel();
    if (!model) return;

    const selection = editor.getSelection();
    const selectedText =
      selection && !selection.isEmpty()
        ? model.getValueInRange(selection)
        : model.getValue();

    if (!selectedText.trim()) {
      setExplainError("Nothing to explain — write or select some code first.");
      return;
    }

    setExplaining(true);
    setExplainError(null);
    setExplanation(null);

    try {
      const res = await aiApi.explain({
        code: selectedText,
        language: languageRef.current,
      });
      setExplanation(res.data?.explanation ?? "No explanation returned.");
    } catch (err) {
      setExplainError(
        err instanceof ApiError
          ? err.message
          : "Failed to explain code. Please try again.",
      );
    } finally {
      setExplaining(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border p-3">
        <Sparkles className="size-4 text-primary" />
        <span className="text-sm font-medium">AI Assistant</span>
        <Button
          size="sm"
          variant="outline"
          className="ml-auto"
          onClick={handleExplain}
          disabled={explaining || !editor}
        >
          {explaining ? <Spinner /> : <WandSparkles />}
          Explain code
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
        <p className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
          Press{" "}
          <kbd className="rounded border border-border bg-background px-1">
            Ctrl/Cmd
          </kbd>
          {" + "}
          <kbd className="rounded border border-border bg-background px-1">
            Space
          </kbd>{" "}
          for an inline suggestion. Accept with{" "}
          <kbd className="rounded border border-border bg-background px-1">
            Tab
          </kbd>
          , dismiss with{" "}
          <kbd className="rounded border border-border bg-background px-1">
            Esc
          </kbd>
          .
        </p>

        {explainError ? (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {explainError}
          </p>
        ) : null}

        {explanation ? (
          <section>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Explanation
            </h3>
            <div className="whitespace-pre-wrap break-words rounded-md bg-muted/60 p-3 text-sm">
              {explanation}
            </div>
          </section>
        ) : null}

        {aiSuggestion ? (
          <section>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Last suggestion
            </h3>
            <pre className="whitespace-pre-wrap break-words rounded-md bg-muted/60 p-3 font-mono text-xs">
              {aiSuggestion}
            </pre>
          </section>
        ) : null}
      </div>
    </div>
  );
}
