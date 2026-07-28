"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { type Paginated, roomsApi } from "@/lib/api";
import type { CreateRoomInput, PaginationParams, Room } from "@/types";

// Centralized, structured query keys so mutations can invalidate precisely.
export const roomKeys = {
  all: ["rooms"] as const,
  lists: () => [...roomKeys.all, "list"] as const,
  list: (params: PaginationParams) => [...roomKeys.lists(), params] as const,
  details: () => [...roomKeys.all, "detail"] as const,
  detail: (slug: string) => [...roomKeys.details(), slug] as const,
};

// Fetches the rooms the current user owns or belongs to, with pagination and
// search. `keepPreviousData` keeps the previous page visible while the next one
// loads, avoiding layout flashes.
export function useRooms(params: PaginationParams = {}) {
  const query = useQuery({
    queryKey: roomKeys.list(params),
    queryFn: () => roomsApi.list(params),
    placeholderData: keepPreviousData,
  });

  return {
    rooms: query.data?.items ?? [],
    meta: query.data?.meta,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

// Creates a room, then invalidates the cached lists so the new room appears.
export function useCreateRoom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateRoomInput) => roomsApi.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: roomKeys.lists() });
    },
  });
}

// Deletes a room with an optimistic update: the room is removed from every
// cached list immediately and restored if the request fails.
export function useDeleteRoom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (slug: string) => roomsApi.remove(slug),
    onMutate: async (slug: string) => {
      await queryClient.cancelQueries({ queryKey: roomKeys.lists() });

      const previous = queryClient.getQueriesData<Paginated<Room>>({
        queryKey: roomKeys.lists(),
      });

      queryClient.setQueriesData<Paginated<Room>>(
        { queryKey: roomKeys.lists() },
        (old) =>
          old
            ? { ...old, items: old.items.filter((room) => room.slug !== slug) }
            : old,
      );

      return { previous };
    },
    onError: (_error, _slug, context) => {
      context?.previous?.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: roomKeys.lists() });
    },
  });
}
