"use client";

import { Crown, Globe, Lock, Users } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn, formatRelativeTime } from "@/lib/utils";
import { SUPPORTED_LANGUAGES, type Room } from "@/types";

interface RoomCardProps {
  room: Room;
  /** The signed-in user's id, used to show the owner badge. */
  currentUserId?: string;
}

function languageLabel(value: string): string {
  return (
    SUPPORTED_LANGUAGES.find((lang) => lang.value === value)?.label ?? value
  );
}

function memberCount(room: Room): number {
  return room._count?.members ?? room.members?.length ?? 1;
}

export function RoomCard({ room, currentUserId }: RoomCardProps) {
  const isOwner = currentUserId != null && room.ownerId === currentUserId;
  const members = memberCount(room);

  return (
    <Link
      href={`/room/${room.slug}`}
      className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card className="h-full transition-colors group-hover:border-primary/50 group-hover:bg-accent/40">
        <CardHeader className="gap-2 pb-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="line-clamp-1 text-base">
              {room.name}
            </CardTitle>
            <span
              className="shrink-0 text-muted-foreground"
              title={room.isPublic ? "Public room" : "Private room"}
            >
              {room.isPublic ? (
                <Globe className="size-4" />
              ) : (
                <Lock className="size-4" />
              )}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{languageLabel(room.language)}</Badge>
            {isOwner ? (
              <Badge
                variant="outline"
                className="border-amber-500/40 text-amber-600 dark:text-amber-400"
              >
                <Crown className="size-3" />
                Owner
              </Badge>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {room.description ? (
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {room.description}
            </p>
          ) : (
            <p className="text-sm italic text-muted-foreground/70">
              No description
            </p>
          )}
          <div
            className={cn(
              "mt-4 flex items-center justify-between text-xs text-muted-foreground",
            )}
          >
            <span className="flex items-center gap-1">
              <Users className="size-3.5" />
              {members} {members === 1 ? "member" : "members"}
            </span>
            <span>Active {formatRelativeTime(room.updatedAt)}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
