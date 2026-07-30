"use client";

import { MicOff, MonitorUp } from "lucide-react";
import { useEffect, useRef } from "react";

import { initialsFromName } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { MediaState } from "@/lib/ws-messages";
import type { RemotePeer } from "@/hooks/useWebRTC";

interface VideoTileProps {
  stream: MediaStream | null;
  name: string;
  avatar?: string;
  color?: string;
  media: MediaState;
  isLocal?: boolean;
  isConnecting?: boolean;
}

// Renders a single participant. A <video> element can only receive a
// MediaStream imperatively via `srcObject`, so it's attached through a ref.
function VideoTile({
  stream,
  name,
  avatar,
  color,
  media,
  isLocal = false,
  isConnecting = false,
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (el && el.srcObject !== stream) {
      el.srcObject = stream;
    }
  }, [stream]);

  const showVideo =
    !!stream &&
    (media.video || media.screen) &&
    stream.getVideoTracks().some((t) => t.readyState === "live");

  return (
    <div className="group relative aspect-video overflow-hidden rounded-lg border border-border bg-muted/40">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={cn(
          "size-full object-cover",
          // Mirror the local camera for a natural selfie view (but not screen shares).
          isLocal && !media.screen && "-scale-x-100",
          showVideo ? "opacity-100" : "opacity-0",
        )}
      />

      {!showVideo ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatar}
              alt={name}
              referrerPolicy="no-referrer"
              className="size-14 rounded-full object-cover"
            />
          ) : (
            <span
              className="flex size-14 items-center justify-center rounded-full text-lg font-semibold text-white"
              style={{ backgroundColor: color ?? "#64748b" }}
            >
              {initialsFromName(name)}
            </span>
          )}
          {isConnecting ? (
            <span className="text-xs text-muted-foreground">Connecting…</span>
          ) : null}
        </div>
      ) : null}

      {/* Name + status chips */}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-linear-to-t from-black/70 to-transparent px-2.5 py-1.5">
        <span className="truncate text-xs font-medium text-white">
          {name}
          {isLocal ? " (you)" : ""}
        </span>
        <div className="flex items-center gap-1.5">
          {media.screen ? (
            <MonitorUp className="size-3.5 text-emerald-400" aria-label="Sharing screen" />
          ) : null}
          {!media.audio ? (
            <MicOff className="size-3.5 text-red-400" aria-label="Muted" />
          ) : null}
        </div>
      </div>
    </div>
  );
}

interface VideoGridProps {
  localStream: MediaStream | null;
  localName: string;
  localAvatar?: string;
  localMedia: MediaState;
  peers: RemotePeer[];
}

export function VideoGrid({
  localStream,
  localName,
  localAvatar,
  localMedia,
  peers,
}: VideoGridProps) {
  const total = peers.length + 1;
  const columns = total <= 1 ? 1 : 2;

  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      <VideoTile
        stream={localStream}
        name={localName}
        avatar={localAvatar}
        media={localMedia}
        isLocal
      />
      {peers.map((peer) => (
        <VideoTile
          key={peer.userId}
          stream={peer.stream}
          name={peer.name}
          avatar={peer.avatar}
          media={peer.media}
          isConnecting={peer.connectionState !== "connected"}
        />
      ))}
    </div>
  );
}
