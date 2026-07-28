"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { roomsApi } from "@/lib/api";
import type { RoomMember } from "@/types";

import { roomKeys } from "./useRooms";

// Fetches a single room by slug together with its members, and exposes
// join/leave mutations. The member list here reflects the last REST snapshot;
// live presence updates arrive separately over the WebSocket layer.
export function useRoom(slug: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: roomKeys.detail(slug),
    queryFn: () => roomsApi.get(slug),
    enabled: Boolean(slug),
  });

  const room = query.data?.data?.room;
  const members: RoomMember[] = room?.members ?? [];

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: roomKeys.detail(slug) });
    void queryClient.invalidateQueries({ queryKey: roomKeys.lists() });
  };

  const join = useMutation({
    mutationFn: () => roomsApi.join(slug),
    onSuccess: invalidate,
  });

  const leave = useMutation({
    mutationFn: () => roomsApi.leave(slug),
    onSuccess: invalidate,
  });

  return {
    room,
    members,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    join,
    leave,
  };
}
