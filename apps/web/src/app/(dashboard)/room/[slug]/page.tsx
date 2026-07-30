"use client";

import { MessageSquare, Play, Sparkles, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { AIAssistant } from "@/components/ai/AIAssistant";
import { LiveCursors } from "@/components/awareness/LiveCursors";
import { TypingIndicator } from "@/components/awareness/TypingIndicator";
import { CallPanel } from "@/components/call/CallPanel";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { EditorInstanceProvider } from "@/components/editor/editor-context";
import { EditorSkeleton } from "@/components/editor/EditorSkeleton";
import { YjsProvider } from "@/components/editor/YjsProvider";
import { ErrorBoundary } from "@/components/error-boundary";
import { ExecutionPanel } from "@/components/execution/ExecutionPanel";
import { RoomHeader } from "@/components/room/RoomHeader";
import { Button } from "@/components/ui/button";
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
        Loading editor…
      </div>
    ),
  },
);

type PanelTab = "chat" | "run" | "ai";

const TABS: { id: PanelTab; label: string; icon: typeof MessageSquare }[] = [
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "run", label: "Run", icon: Play },
  { id: "ai", label: "AI", icon: Sparkles },
];

export default function RoomPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  // Redundant with the dashboard layout guard, but explicit per the spec.
  const { user } = useAuth({ required: true });

  const { room, isLoading, isError } = useRoom(slug);
  const setLanguage = useEditorStore((s) => s.setLanguage);
  const [tab, setTab] = useState<PanelTab>("chat");
  const [mobilePanel, setMobilePanel] = useState<PanelTab | null>(null);

  useEffect(() => {
    if (room?.language) {
      setLanguage(room.language as SupportedLanguage);
    }
  }, [room?.language, setLanguage]);

  if (isLoading) {
    return <EditorSkeleton />;
  }

  if (isError || !room) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
        <p className="font-medium">Room not found</p>
        <p className="text-sm text-muted-foreground">
          It may have been deleted or you don&apos;t have access.
        </p>
        <Button variant="outline" className="mt-2" asChild>
          <a href="/dashboard">Back to rooms</a>
        </Button>
      </div>
    );
  }

  // The session user id is the GitHub id, while room.ownerId is the ws-server's
  // database uuid — they never match directly. The detail response includes the
  // owner's githubId, so compare on that instead.
  const isOwner =
    !!user &&
    room.owner?.githubId != null &&
    room.owner.githubId === (user.githubId ?? user.id);

  const renderPanel = (id: PanelTab) => {
    if (id === "chat") return <ChatPanel />;
    if (id === "run")
      return (
        <ExecutionPanel
          roomId={room.id}
          canClearHistory={isOwner}
        />
      );
    return <AIAssistant />;
  };

  return (
    <YjsProvider roomId={room.id}>
      <EditorInstanceProvider>
        <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
          <RoomHeader room={room} />

          <div className="flex min-h-0 flex-1">
            {/* Editor + awareness overlays. Isolated so a Monaco crash doesn't
                take down chat/execution. */}
            <div className="relative min-w-0 flex-1">
              <ErrorBoundary
                label="editor"
                fallback={(error, reset) => (
                  <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                    <p className="font-medium">The editor crashed</p>
                    <p className="max-w-sm text-sm text-muted-foreground">
                      {error.message ||
                        "Monaco failed to render. Your document is safe on the server."}
                    </p>
                    <Button variant="outline" size="sm" onClick={reset}>
                      Reload editor
                    </Button>
                  </div>
                )}
              >
                <CodeEditor />
                <LiveCursors />
                <TypingIndicator />
              </ErrorBoundary>
            </div>

            {/* Desktop side panels */}
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
                <ErrorBoundary label="panel">{renderPanel(tab)}</ErrorBoundary>
              </div>
            </aside>
          </div>

          {/* Mobile action bar (panels are hidden on small screens) */}
          <div className="flex border-t border-border md:hidden">
            {TABS.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setMobilePanel(t.id)}
                  className="flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Icon className="size-4" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Mobile bottom sheet */}
        {mobilePanel ? (
          <div className="fixed inset-0 z-50 md:hidden">
            <div
              className="absolute inset-0 bg-black/60"
              onClick={() => setMobilePanel(null)}
              aria-hidden
            />
            <div className="absolute inset-x-0 bottom-0 flex h-[75vh] flex-col rounded-t-xl border-t border-border bg-card shadow-xl">
              <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                <span className="text-sm font-semibold capitalize">
                  {TABS.find((t) => t.id === mobilePanel)?.label}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Close panel"
                  onClick={() => setMobilePanel(null)}
                >
                  <X />
                </Button>
              </div>
              <div className="min-h-0 flex-1">
                <ErrorBoundary label="panel">
                  {renderPanel(mobilePanel)}
                </ErrorBoundary>
              </div>
            </div>
          </div>
        ) : null}

        {/* Floating WebRTC audio/video + screen-share overlay. Isolated so a
            call error never takes down the editor. */}
        <ErrorBoundary label="call" fallback={() => null}>
          <CallPanel />
        </ErrorBoundary>
      </EditorInstanceProvider>
    </YjsProvider>
  );
}
