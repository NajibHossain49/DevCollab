"use client";

import {
  Mic,
  MicOff,
  MonitorOff,
  MonitorUp,
  PhoneOff,
  Video,
  VideoOff,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MediaState } from "@/lib/ws-messages";

interface CallControlsProps {
  media: MediaState;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onLeave: () => void;
}

interface ControlButtonProps {
  active: boolean;
  activeLabel: string;
  inactiveLabel: string;
  ActiveIcon: typeof Mic;
  InactiveIcon: typeof Mic;
  onClick: () => void;
  disabled?: boolean;
}

function ControlButton({
  active,
  activeLabel,
  inactiveLabel,
  ActiveIcon,
  InactiveIcon,
  onClick,
  disabled,
}: ControlButtonProps) {
  const Icon = active ? ActiveIcon : InactiveIcon;
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={active ? activeLabel : inactiveLabel}
      title={active ? activeLabel : inactiveLabel}
      className={cn(
        "size-10 rounded-full",
        active
          ? "bg-secondary text-secondary-foreground hover:bg-secondary/80"
          : "bg-destructive/15 text-destructive hover:bg-destructive/25",
      )}
    >
      <Icon />
    </Button>
  );
}

export function CallControls({
  media,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onLeave,
}: CallControlsProps) {
  return (
    <div className="flex items-center justify-center gap-2">
      <ControlButton
        active={media.audio}
        activeLabel="Mute microphone"
        inactiveLabel="Unmute microphone"
        ActiveIcon={Mic}
        InactiveIcon={MicOff}
        onClick={onToggleAudio}
      />
      <ControlButton
        active={media.video}
        activeLabel="Turn off camera"
        inactiveLabel="Turn on camera"
        ActiveIcon={Video}
        InactiveIcon={VideoOff}
        onClick={onToggleVideo}
        disabled={media.screen}
      />
      <ControlButton
        active={media.screen}
        activeLabel="Stop sharing screen"
        inactiveLabel="Share screen"
        ActiveIcon={MonitorUp}
        InactiveIcon={MonitorOff}
        onClick={onToggleScreenShare}
      />
      <Button
        type="button"
        variant="destructive"
        size="icon"
        onClick={onLeave}
        aria-label="Leave call"
        title="Leave call"
        className="size-10 rounded-full"
      >
        <PhoneOff />
      </Button>
    </div>
  );
}
