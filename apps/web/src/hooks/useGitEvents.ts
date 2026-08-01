"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { useYjs } from "@/components/editor/YjsProvider";
import type { GitEventMessage, ServerMessage } from "@/lib/ws-messages";
import { gitKeys } from "@/hooks/useGit";

export type GitEvent = GitEventMessage["payload"];

// Subscribes to real-time GIT_EVENT messages for the current room, keeps a
// short rolling log, and invalidates the relevant Git queries so panels
// (PRs, commits, issues) refresh automatically.
export function useGitEvents(roomId: string): GitEvent[] {
  const { provider } = useYjs();
  const queryClient = useQueryClient();
  const [events, setEvents] = useState<GitEvent[]>([]);

  useEffect(() => {
    if (!provider) return;

    const off = provider.on("message", (message: ServerMessage) => {
      if (message.type !== "GIT_EVENT") return;
      setEvents((prev) => [message.payload, ...prev].slice(0, 20));

      void queryClient.invalidateQueries({ queryKey: [...gitKeys.all, "prs", roomId] });
      void queryClient.invalidateQueries({ queryKey: [...gitKeys.all, "commits", roomId] });
      void queryClient.invalidateQueries({ queryKey: [...gitKeys.all, "issues", roomId] });
    });

    return off;
  }, [provider, queryClient, roomId]);

  return events;
}
