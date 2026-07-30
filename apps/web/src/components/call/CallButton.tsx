"use client";

import { Video } from "lucide-react";

import { useCall } from "@/components/call/call-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Room-header trigger for the audio/video call. Doubles as a live "in call"
// indicator that expands/collapses the floating video panel.
export function CallButton() {
  const {
    inCall,
    isConnecting,
    canJoin,
    peers,
    minimized,
    setMinimized,
    joinCall,
    error,
  } = useCall();

  if (inCall) {
    const participants = peers.length + 1;
    return (
      <Button
        type="button"
        size="sm"
        onClick={() => setMinimized(!minimized)}
        className="bg-emerald-600 text-white hover:bg-emerald-600/90"
        title={minimized ? "Expand call" : "Collapse call"}
      >
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-white/80 opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-white" />
        </span>
        In call · {participants}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => void joinCall()}
      disabled={!canJoin || isConnecting}
      className={cn(error && "border-destructive/50 text-destructive")}
      title={
        error ?? (canJoin ? "Start / join the call" : "Connecting to room…")
      }
    >
      <Video />
      {isConnecting ? "Joining…" : "Call"}
    </Button>
  );
}
