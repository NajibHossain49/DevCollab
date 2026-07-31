"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { billingApi } from "@/lib/api";

export const billingKeys = {
  all: ["billing"] as const,
  status: (slug: string) => [...billingKeys.all, slug] as const,
};

// Fetches the organization's current plan and subscription status.
export function useBilling(slug: string) {
  const query = useQuery({
    queryKey: billingKeys.status(slug),
    queryFn: () => billingApi.status(slug),
    enabled: Boolean(slug),
  });

  return {
    billing: query.data?.data?.billing,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

// Starts a Stripe Checkout and returns the redirect URL.
export function useCheckout(slug: string) {
  return useMutation({
    mutationFn: () => billingApi.checkout(slug),
  });
}

// Opens the Stripe billing portal.
export function useBillingPortal(slug: string) {
  return useMutation({
    mutationFn: () => billingApi.portal(slug),
  });
}

// Confirms a completed checkout (webhook-free path) and refreshes status.
export function useVerifyCheckout(slug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sessionId: string) => billingApi.verify(slug, sessionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: billingKeys.status(slug) });
    },
  });
}
