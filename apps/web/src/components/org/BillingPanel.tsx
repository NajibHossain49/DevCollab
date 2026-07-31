"use client";

import { CheckCircle2, CreditCard, Sparkles, XCircle } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  useBilling,
  useBillingPortal,
  useCheckout,
  useVerifyCheckout,
} from "@/hooks/useBilling";
import { ApiError } from "@/lib/api";

interface BillingPanelProps {
  slug: string;
  canManage: boolean;
}

const PRO_FEATURES = [
  "Unlimited organization rooms",
  "Team analytics & coding insights",
  "Priority code execution",
  "Advanced member roles",
];

export function BillingPanel({ slug, canManage }: BillingPanelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const { billing, isLoading } = useBilling(slug);
  const checkout = useCheckout(slug);
  const portal = useBillingPortal(slug);
  const verify = useVerifyCheckout(slug);

  const [notice, setNotice] = useState<
    { kind: "success" | "error" | "cancelled"; message: string } | null
  >(null);
  const verifiedRef = useRef(false);

  // Handle the return from Stripe Checkout: ?billing=success&session_id=...
  useEffect(() => {
    const billingParam = searchParams.get("billing");
    if (!billingParam || verifiedRef.current) return;

    if (billingParam === "cancelled") {
      verifiedRef.current = true;
      setNotice({ kind: "cancelled", message: "Checkout was cancelled." });
      router.replace(`/orgs/${slug}`);
      return;
    }

    if (billingParam === "success") {
      const sessionId = searchParams.get("session_id");
      verifiedRef.current = true;
      if (!sessionId) {
        setNotice({ kind: "success", message: "Payment received." });
        router.replace(`/orgs/${slug}`);
        return;
      }
      verify
        .mutateAsync(sessionId)
        .then(() =>
          setNotice({
            kind: "success",
            message: "You're now on the Pro plan. Thanks for the support!",
          }),
        )
        .catch((err) =>
          setNotice({
            kind: "error",
            message:
              err instanceof ApiError
                ? err.message
                : "We couldn't confirm the payment. It may take a moment to sync.",
          }),
        )
        .finally(() => router.replace(`/orgs/${slug}`));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, slug]);

  const handleUpgrade = async () => {
    setNotice(null);
    try {
      const res = await checkout.mutateAsync();
      const url = res.data?.url;
      if (url) window.location.href = url;
    } catch (err) {
      setNotice({
        kind: "error",
        message: err instanceof ApiError ? err.message : "Failed to start checkout.",
      });
    }
  };

  const handleManage = async () => {
    setNotice(null);
    try {
      const res = await portal.mutateAsync();
      const url = res.data?.url;
      if (url) window.location.href = url;
    } catch (err) {
      setNotice({
        kind: "error",
        message: err instanceof ApiError ? err.message : "Failed to open billing portal.",
      });
    }
  };

  if (isLoading || !billing) {
    return <Skeleton className="h-48 w-full" />;
  }

  const isPro = billing.plan === "PRO";
  const periodEnd = billing.currentPeriodEnd
    ? new Date(billing.currentPeriodEnd).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      {notice ? (
        <div
          className={
            "flex items-center gap-2 rounded-md px-3 py-2 text-sm " +
            (notice.kind === "error"
              ? "bg-destructive/10 text-destructive"
              : "bg-primary/10 text-foreground")
          }
        >
          {notice.kind === "error" ? (
            <XCircle className="size-4" />
          ) : (
            <CheckCircle2 className="size-4" />
          )}
          {notice.message}
        </div>
      ) : null}

      <Card className="flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="size-5 text-muted-foreground" />
            <span className="font-semibold">Current plan</span>
          </div>
          <Badge variant={isPro ? "default" : "secondary"}>
            {isPro ? "Pro" : "Free"}
          </Badge>
        </div>

        {isPro ? (
          <p className="text-sm text-muted-foreground">
            {billing.subscriptionStatus === "active"
              ? periodEnd
                ? `Your subscription renews on ${periodEnd}.`
                : "Your Pro subscription is active."
              : `Subscription status: ${billing.subscriptionStatus ?? "unknown"}.`}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            You&apos;re on the Free plan. Upgrade to unlock more for your team.
          </p>
        )}

        {!billing.enabled ? (
          <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            Billing isn&apos;t configured on this server yet. Add your Stripe
            test keys to enable upgrades.
          </p>
        ) : null}
      </Card>

      {!isPro ? (
        <Card className="flex flex-col gap-4 p-5">
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            <span className="font-semibold">DevCollab Pro</span>
            <Badge variant="outline" className="ml-1 text-[10px]">
              Test mode
            </Badge>
          </div>
          <ul className="flex flex-col gap-2">
            {PRO_FEATURES.map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="size-4 text-primary" />
                {feature}
              </li>
            ))}
          </ul>
          {canManage ? (
            <Button
              onClick={handleUpgrade}
              disabled={!billing.enabled || checkout.isPending}
              className="self-start"
            >
              {checkout.isPending ? (
                <Spinner className="text-primary-foreground" />
              ) : (
                <Sparkles />
              )}
              Upgrade to Pro
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">
              Only owners and admins can manage billing.
            </p>
          )}
        </Card>
      ) : canManage ? (
        <Button
          variant="outline"
          onClick={handleManage}
          disabled={portal.isPending}
          className="self-start"
        >
          {portal.isPending ? <Spinner /> : <CreditCard />}
          Manage subscription
        </Button>
      ) : null}
    </div>
  );
}
