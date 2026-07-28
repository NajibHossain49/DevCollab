"use client";

import { useEffect, useState } from "react";

import { useAuth } from "@/hooks/useAuth";
import { useEditorStore } from "@/stores/editor.store";

const STALE_MS = 4_000;

// Renders an "X is typing…" style indicator driven by AWARENESS_UPDATE. A
// short client-side staleness window auto-hides indicators if a peer stops
// broadcasting (e.g. after a disconnect).
export function TypingIndicator() {
  const { user } = useAuth();
  const activeUsers = useEditorStore((s) => s.activeUsers);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(interval);
  }, []);

  const typers = activeUsers.filter(
    (u) =>
      u.isTyping &&
      u.userId !== user?.id &&
      now - new Date(u.lastSeen).getTime() < STALE_MS,
  );

  if (typers.length === 0) return null;

  const names = typers.map((t) => t.name);
  let label: string;
  if (names.length === 1) {
    label = `${names[0]} is typing…`;
  } else if (names.length === 2) {
    label = `${names[0]} and ${names[1]} are typing…`;
  } else {
    label = "Several people are typing…";
  }

  return (
    <div className="pointer-events-none absolute bottom-2 left-3 z-10 flex items-center gap-2 rounded-md bg-background/90 px-2.5 py-1 text-xs text-muted-foreground shadow-sm backdrop-blur">
      <span className="flex gap-0.5">
        <Dot delay={0} />
        <Dot delay={150} />
        <Dot delay={300} />
      </span>
      {label}
    </div>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <span
      className="inline-block size-1 animate-bounce rounded-full bg-muted-foreground"
      style={{ animationDelay: `${delay}ms` }}
    />
  );
}
