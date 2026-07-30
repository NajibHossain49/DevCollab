"use client";

import { ChevronDown, Phone, Users, Video as VideoIcon } from "lucide-react";
import { useState } from "react";

import { CallControls } from "@/components/call/CallControls";
import { VideoGrid } from "@/components/call/VideoGrid";
import { useYjs } from "@/components/editor/YjsProvider";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useWebRTC } from "@/hooks/useWebRTC";
import { cn } from "@/lib/utils";

// Floating, hideable audio/video call overlay for a room. Signaling is
// multiplexed over the room's existing collaboration WebSocket (via the Yjs
// provider), so it never disturbs Monaco/Yjs editing.
export function CallPanel() {
  const { provider, status } = useYjs();
  const { user } = useAuth();
  const [minimized, setMinimized] = useState(false);

  const self = user
    ? { id: user.id, name: user.name ?? "You", avatar: user.avatar ?? undefined }
    : null;

  const {
    inCall,
    isConnecting,
    localStream,
    peers,
    mediaState,
    error,
    joinCall,
    leaveCall,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
  } = useWebRTC({ provider, self, enabled: Boolean(provider) });

  const canJoin = status === "connected" && Boolean(provider) && Boolean(self);

  // --- Idle: a single floating "call" button --------------------------------
  if (!inCall) {
    return (
      <div className="fixed bottom-4 right-4 z-40">
        <Button
          type="button"
          onClick={() => void joinCall()}
          disabled={!canJoin || isConnecting}
          className="rounded-full shadow-lg"
          title={canJoin ? "Start / join the call" : "Connecting to room…"}
        >
          <VideoIcon />
          {isConnecting ? "Joining…" : "Join call"}
        </Button>
        {error ? (
          <p className="mt-2 max-w-56 rounded-md bg-destructive/10 px-2 py-1 text-right text-xs text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  const participantCount = peers.length + 1;

  // --- Minimized: compact bar with quick controls ---------------------------
  if (minimized) {
    return (
      <div className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 shadow-xl">
        <button
          type="button"
          onClick={() => setMinimized(false)}
          className="flex items-center gap-1.5 text-sm font-medium text-foreground"
          title="Expand call"
        >
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
          </span>
          <Users className="size-4" />
          {participantCount}
        </button>
        <CallControls
          media={mediaState}
          onToggleAudio={toggleAudio}
          onToggleVideo={() => void toggleVideo()}
          onToggleScreenShare={() => void toggleScreenShare()}
          onLeave={leaveCall}
        />
      </div>
    );
  }

  // --- Expanded panel -------------------------------------------------------
  return (
    <div className="fixed bottom-4 right-4 z-40 flex w-85 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Phone className="size-4 text-emerald-500" />
          Call
          <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
            <Users className="size-3.5" />
            {participantCount}
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={() => setMinimized(true)}
          aria-label="Minimize call"
          title="Minimize call"
        >
          <ChevronDown />
        </Button>
      </div>

      <div
        className={cn(
          "max-h-[50vh] overflow-y-auto p-3",
          peers.length === 0 && "pb-2",
        )}
      >
        <VideoGrid
          localStream={localStream}
          localName={self?.name ?? "You"}
          localAvatar={self?.avatar}
          localMedia={mediaState}
          peers={peers}
        />
        {peers.length === 0 ? (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Waiting for others to join…
          </p>
        ) : null}
      </div>

      <div className="border-t border-border px-3 py-2.5">
        {error ? (
          <p className="mb-2 text-center text-xs text-destructive">{error}</p>
        ) : null}
        <CallControls
          media={mediaState}
          onToggleAudio={toggleAudio}
          onToggleVideo={() => void toggleVideo()}
          onToggleScreenShare={() => void toggleScreenShare()}
          onLeave={leaveCall}
        />
      </div>
    </div>
  );
}
