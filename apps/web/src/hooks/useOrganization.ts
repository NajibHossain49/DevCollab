"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { orgsApi } from "@/lib/api";
import type {
  CreateOrgInput,
  InviteMemberInput,
  OrganizationMember,
  OrgRole,
  UpdateOrgInput,
} from "@/types";

// Structured query keys so mutations can invalidate precisely.
export const orgKeys = {
  all: ["orgs"] as const,
  lists: () => [...orgKeys.all, "list"] as const,
  details: () => [...orgKeys.all, "detail"] as const,
  detail: (slug: string) => [...orgKeys.details(), slug] as const,
  analytics: (slug: string) => [...orgKeys.all, "analytics", slug] as const,
};

// Lists the organizations the current user belongs to (org switcher).
export function useOrganizations() {
  const query = useQuery({
    queryKey: orgKeys.lists(),
    queryFn: () => orgsApi.list(),
  });

  return {
    organizations: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

// Fetches a single organization by slug together with its members.
export function useOrganization(slug: string) {
  const query = useQuery({
    queryKey: orgKeys.detail(slug),
    queryFn: () => orgsApi.get(slug),
    enabled: Boolean(slug),
  });

  const organization = query.data?.data?.organization;

  return {
    organization,
    members: organization?.members ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

// Convenience hook: just the member list for an organization.
export function useOrgMembers(slug: string): OrganizationMember[] {
  const { members } = useOrganization(slug);
  return members;
}

export function useOrgAnalytics(slug: string) {
  const query = useQuery({
    queryKey: orgKeys.analytics(slug),
    queryFn: () => orgsApi.analytics(slug),
    enabled: Boolean(slug),
  });

  return {
    analytics: query.data?.data?.analytics,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
  };
}

export function useCreateOrg() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateOrgInput) => orgsApi.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orgKeys.lists() });
    },
  });
}

export function useUpdateOrg(slug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateOrgInput) => orgsApi.update(slug, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orgKeys.detail(slug) });
      void queryClient.invalidateQueries({ queryKey: orgKeys.lists() });
    },
  });
}

export function useInviteMember(slug: string) {
  return useMutation({
    mutationFn: (input: InviteMemberInput) => orgsApi.invite(slug, input),
  });
}

export function useAcceptInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (token: string) => orgsApi.acceptInvite(token),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orgKeys.lists() });
    },
  });
}

export function useUpdateMemberRole(slug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      userId,
      role,
    }: {
      userId: string;
      role: Exclude<OrgRole, "OWNER">;
    }) => orgsApi.updateMemberRole(slug, userId, role),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orgKeys.detail(slug) });
    },
  });
}

export function useRemoveMember(slug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => orgsApi.removeMember(slug, userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orgKeys.detail(slug) });
      void queryClient.invalidateQueries({ queryKey: orgKeys.analytics(slug) });
    },
  });
}
