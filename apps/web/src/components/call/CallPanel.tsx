"use client";

import { ChevronDown, Phone, Users } from "lucide-react";

import { CallControls } from "@/components/call/CallControls";
import { useCall } from "@/components/call/call-context";
import { VideoGrid } from "@/components/call/VideoGrid";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Floating, hideable audio/video call overlay. The call lifecycle lives in
// CallProvider (shared with the header trigger); this component only renders
// the video UI while a call is active.
export function CallPanel() {
  const { user } = useAuth();
  const {
    inCall,
    localStream,
    peers,
    mediaState,
    error,
    minimized,
    setMinimized,
    leaveCall,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
  } = useCall();

  if (!inCall) return null;

  const selfName = user?.name ?? "You";
  const selfAvatar = user?.avatar ?? undefined;
  const participantCount = peers.length + 1;

  const controls = (
    <CallControls
      media={mediaState}
      onToggleAudio={toggleAudio}
      onToggleVideo={() => void toggleVideo()}
      onToggleScreenShare={() => void toggleScreenShare()}
      onLeave={leaveCall}
    />
  );

  // --- Minimized: compact floating bar ---------------------------------------
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
        {controls}
      </div>
    );
  }

  // --- Expanded panel --------------------------------------------------------
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

      <div className={cn("max-h-[50vh] overflow-y-auto p-3", peers.length === 0 && "pb-2")}>
        <VideoGrid
          localStream={localStream}
          localName={selfName}
          localAvatar={selfAvatar}
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
        {error ? <p className="mb-2 text-center text-xs text-destructive">{error}</p> : null}
        {controls}
      </div>
    </div>
  );
}
