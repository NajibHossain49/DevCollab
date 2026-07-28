"use client";

import Editor, { type OnMount } from "@monaco-editor/react";
import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";
import { MonacoBinding } from "y-monaco";

import { useEditorInstance } from "@/components/editor/editor-context";
import { useYjs } from "@/components/editor/YjsProvider";
import { Spinner } from "@/components/ui/spinner";
import { useEditorStore } from "@/stores/editor.store";

const CURSOR_THROTTLE_MS = 60;
const TYPING_IDLE_MS = 2_000;

export function CodeEditor() {
  const { yText, sendCursor, sendTyping } = useYjs();
  const { setInstances } = useEditorInstance();
  const { resolvedTheme } = useTheme();

  const language = useEditorStore((s) => s.language);
  const setCurrentCode = useEditorStore((s) => s.setCurrentCode);

  const bindingRef = useRef<MonacoBinding | null>(null);
  const lastCursorSentRef = useRef(0);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      bindingRef.current?.destroy();
      bindingRef.current = null;
    };
  }, []);

  const handleMount: OnMount = (editor, monaco) => {
    const model = editor.getModel();
    if (model) {
      // Bind the shared Y.Text to this editor's model. Awareness is handled
      // separately via the custom cursor protocol, so we pass null here.
      bindingRef.current = new MonacoBinding(
        yText,
        model,
        new Set([editor]),
        null,
      );
    }

    setInstances(editor, monaco);
    setCurrentCode(yText.toString());

    // Mirror document text into the store for execution / AI features.
    const observer = (): void => setCurrentCode(yText.toString());
    yText.observe(observer);
    editor.onDidDispose(() => yText.unobserve(observer));

    // Relay local cursor movement (throttled) as protocol {line, ch}.
    editor.onDidChangeCursorPosition((event) => {
      const now = Date.now();
      if (now - lastCursorSentRef.current < CURSOR_THROTTLE_MS) return;
      lastCursorSentRef.current = now;
      sendCursor({
        line: event.position.lineNumber - 1,
        ch: event.position.column - 1,
      });
    });

    // Typing indicator: emit true on edit, then auto-clear after idle.
    editor.onDidChangeModelContent(() => {
      if (!isTypingRef.current) {
        isTypingRef.current = true;
        sendTyping(true);
      }
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        isTypingRef.current = false;
        sendTyping(false);
      }, TYPING_IDLE_MS);
    });
  };

  return (
    <Editor
      height="100%"
      theme={resolvedTheme === "dark" ? "vs-dark" : "vs"}
      language={language}
      onMount={handleMount}
      loading={
        <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
          <Spinner /> Loading editor…
        </div>
      }
      options={{
        minimap: { enabled: true },
        lineNumbers: "on",
        automaticLayout: true,
        fontSize: 14,
        tabSize: 2,
        scrollBeyondLastLine: false,
        smoothScrolling: true,
        cursorSmoothCaretAnimation: "on",
        padding: { top: 12 },
      }}
    />
  );
}
