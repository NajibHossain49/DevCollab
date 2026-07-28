"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { AIAssistant } from "@/components/ai/AIAssistant";
import { LiveCursors } from "@/components/awareness/LiveCursors";
import { TypingIndicator } from "@/components/awareness/TypingIndicator";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { EditorInstanceProvider } from "@/components/editor/editor-context";
import { YjsProvider } from "@/components/editor/YjsProvider";
import { ExecutionPanel } from "@/components/execution/ExecutionPanel";
import { RoomHeader } from "@/components/room/RoomHeader";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/hooks/useAuth";
import { useRoom } from "@/hooks/useRoom";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/editor.store";
import type { SupportedLanguage } from "@/types";

// Monaco pulls in browser-only modules (web workers, y-monaco); load it lazily
// with SSR disabled.
const CodeEditor = dynamic(
  () => import("@/components/editor/CodeEditor").then((m) => m.CodeEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
        <Spinner /> Loading editor…
      </div>
    ),
  },
);

type PanelTab = "chat" | "run" | "ai";

const TABS: { id: PanelTab; label: string }[] = [
  { id: "chat", label: "Chat" },
  { id: "run", label: "Run" },
  { id: "ai", label: "AI" },
];

export default function RoomPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  // Redundant with the dashboard layout guard, but explicit per the spec.
  useAuth({ required: true });

  const { room, isLoading, isError } = useRoom(slug);
  const setLanguage = useEditorStore((s) => s.setLanguage);
  const [tab, setTab] = useState<PanelTab>("chat");

  useEffect(() => {
    if (room?.language) {
      setLanguage(room.language as SupportedLanguage);
    }
  }, [room?.language, setLanguage]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-muted-foreground">
        <Spinner />
        <span className="text-sm">Loading room…</span>
      </div>
    );
  }

  if (isError || !room) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
        <p className="font-medium">Room not found</p>
        <p className="text-sm text-muted-foreground">
          It may have been deleted or you don&apos;t have access.
        </p>
      </div>
    );
  }

  return (
    <YjsProvider roomId={room.id}>
      <EditorInstanceProvider>
        <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
          <RoomHeader room={room} />

          <div className="flex min-h-0 flex-1">
            {/* Editor + awareness overlays */}
            <div className="relative min-w-0 flex-1">
              <CodeEditor />
              <LiveCursors />
              <TypingIndicator />
            </div>

            {/* Side panels */}
            <aside className="hidden w-96 shrink-0 flex-col border-l border-border md:flex">
              <div className="flex border-b border-border">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={cn(
                      "flex-1 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                      tab === t.id
                        ? "border-primary text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="min-h-0 flex-1">
                {tab === "chat" ? <ChatPanel /> : null}
                {tab === "run" ? <ExecutionPanel roomId={room.id} /> : null}
                {tab === "ai" ? <AIAssistant /> : null}
              </div>
            </aside>
          </div>
        </div>
      </EditorInstanceProvider>
    </YjsProvider>
  );
}
