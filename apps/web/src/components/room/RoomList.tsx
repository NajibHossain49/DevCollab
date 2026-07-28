"use client";

import { FolderPlus, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { CreateRoomModal } from "@/components/room/CreateRoomModal";
import { RoomCard } from "@/components/room/RoomCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useDebounce } from "@/hooks/useDebounce";
import { useRooms } from "@/hooks/useRooms";
import type { Room } from "@/types";

type SortKey = "recent" | "name";

function sortRooms(rooms: Room[], sort: SortKey): Room[] {
  const copy = [...rooms];
  if (sort === "name") {
    return copy.sort((a, b) => a.name.localeCompare(b.name));
  }
  return copy.sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export function RoomList() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [createOpen, setCreateOpen] = useState(false);

  const debouncedSearch = useDebounce(search.trim(), 300);
  const { rooms, isLoading, isFetching, isError, refetch } = useRooms({
    search: debouncedSearch || undefined,
    limit: 50,
  });

  const sortedRooms = useMemo(
    () => sortRooms(rooms, sort),
    [rooms, sort],
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search rooms…"
            className="pl-9"
            aria-label="Search rooms"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={sort}
            onChange={(event) => setSort(event.target.value as SortKey)}
            aria-label="Sort rooms"
            className="w-40"
          >
            <option value="recent">Recently active</option>
            <option value="name">Name (A–Z)</option>
          </Select>
          <Button onClick={() => setCreateOpen(true)}>
            <FolderPlus />
            New room
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card
              key={index}
              className="h-40 animate-pulse bg-muted/40"
              aria-hidden
            />
          ))}
        </div>
      ) : isError ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Failed to load rooms.
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Try again
          </Button>
        </Card>
      ) : sortedRooms.length === 0 ? (
        <Card className="flex flex-col items-center gap-4 p-12 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-muted">
            <FolderPlus className="size-7 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <p className="font-medium">
              {debouncedSearch ? "No rooms match your search" : "No rooms yet"}
            </p>
            <p className="text-sm text-muted-foreground">
              {debouncedSearch
                ? "Try a different search term."
                : "Create your first room to start collaborating."}
            </p>
          </div>
          {!debouncedSearch ? (
            <Button onClick={() => setCreateOpen(true)}>
              <FolderPlus />
              Create room
            </Button>
          ) : null}
        </Card>
      ) : (
        <div
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          aria-busy={isFetching}
        >
          {sortedRooms.map((room) => (
            <RoomCard key={room.id} room={room} currentUserId={user?.id} />
          ))}
        </div>
      )}

      <CreateRoomModal open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
