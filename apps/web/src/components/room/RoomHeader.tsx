"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Globe, Lock, Settings, Share2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { initialsFromName } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { roomKeys } from "@/hooks/useRooms";
import { cn } from "@/lib/utils";
import type { ConnectionStatus } from "@/lib/ws-messages";
import { roomsApi } from "@/lib/api";
import { useEditorStore } from "@/stores/editor.store";
import {
  SUPPORTED_LANGUAGES,
  type Room,
  type SupportedLanguage,
  type UpdateRoomInput,
} from "@/types";

const STATUS_META: Record<
  ConnectionStatus,
  { label: string; color: string }
> = {
  connecting: { label: "Connecting", color: "bg-amber-500" },
  connected: { label: "Connected", color: "bg-emerald-500" },
  reconnecting: { label: "Reconnecting", color: "bg-amber-500" },
  disconnected: { label: "Disconnected", color: "bg-destructive" },
};

const MAX_VISIBLE_AVATARS = 5;

export function RoomHeader({ room }: { room: Room }) {
  const queryClient = useQueryClient();

  const activeUsers = useEditorStore((s) => s.activeUsers);
  const connectionStatus = useEditorStore((s) => s.connectionStatus);
  const language = useEditorStore((s) => s.language);
  const setLanguage = useEditorStore((s) => s.setLanguage);

  const [isPublic, setIsPublic] = useState(room.isPublic);
  const [copied, setCopied] = useState(false);

  const updateMutation = useMutation({
    mutationFn: (data: UpdateRoomInput) => roomsApi.update(room.slug, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: roomKeys.detail(room.slug) });
      void queryClient.invalidateQueries({ queryKey: roomKeys.lists() });
    },
  });

  const handleShare = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1_500);
    } catch {
      // Clipboard may be unavailable; ignore.
    }
  };

  const handleLanguageChange = (next: SupportedLanguage): void => {
    setLanguage(next);
    updateMutation.mutate({ language: next });
  };

  const handleVisibilityChange = (next: boolean): void => {
    setIsPublic(next);
    updateMutation.mutate({ isPublic: next });
  };

  const status = STATUS_META[connectionStatus];
  const visibleUsers = activeUsers.slice(0, MAX_VISIBLE_AVATARS);
  const overflow = activeUsers.length - visibleUsers.length;

  return (
    <header className="flex h-14 items-center gap-3 border-b border-border bg-background px-4">
      <Link
        href="/dashboard"
        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        ← Rooms
      </Link>

      <div className="flex items-center gap-2">
        <h1 className="max-w-56 truncate font-semibold" title={room.name}>
          {room.name}
        </h1>
        <Badge variant="secondary">
          {SUPPORTED_LANGUAGES.find((l) => l.value === language)?.label ??
            language}
        </Badge>
        <span
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
          title={status.label}
        >
          <span className={cn("size-2 rounded-full", status.color)} />
          {status.label}
        </span>
      </div>

      <div className="ml-auto flex items-center gap-3">
        {/* Stacked member avatars from live awareness. */}
        <div className="flex items-center">
          {visibleUsers.map((user, index) => (
            <span
              key={user.userId}
              title={user.name}
              className="flex size-7 items-center justify-center rounded-full border-2 border-background text-[10px] font-semibold text-white"
              style={{
                backgroundColor: user.color,
                marginLeft: index === 0 ? 0 : -8,
                zIndex: MAX_VISIBLE_AVATARS - index,
              }}
            >
              {initialsFromName(user.name)}
            </span>
          ))}
          {overflow > 0 ? (
            <span
              className="flex size-7 items-center justify-center rounded-full border-2 border-background bg-muted text-[10px] font-semibold text-muted-foreground"
              style={{ marginLeft: -8 }}
            >
              +{overflow}
            </span>
          ) : null}
        </div>

        <Button variant="outline" size="sm" onClick={handleShare}>
          {copied ? <Check /> : <Share2 />}
          {copied ? "Copied" : "Share"}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Room settings"
            className="inline-flex size-9 items-center justify-center rounded-md text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-4"
          >
            <Settings />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 p-3">
            <DropdownMenuLabel>Room settings</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="flex flex-col gap-3 py-1">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="room-language-setting">Language</Label>
                <Select
                  id="room-language-setting"
                  value={language}
                  onChange={(event) =>
                    handleLanguageChange(
                      event.target.value as SupportedLanguage,
                    )
                  }
                >
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <option key={lang.value} value={lang.value}>
                      {lang.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="room-visibility-setting"
                  className="flex items-center gap-1.5"
                >
                  {isPublic ? (
                    <Globe className="size-3.5" />
                  ) : (
                    <Lock className="size-3.5" />
                  )}
                  {isPublic ? "Public" : "Private"}
                </Label>
                <Switch
                  id="room-visibility-setting"
                  checked={isPublic}
                  onCheckedChange={handleVisibilityChange}
                  aria-label="Toggle room visibility"
                />
              </div>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
