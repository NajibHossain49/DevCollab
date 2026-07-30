"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/hooks/useAuth";
import { useAcceptInvite } from "@/hooks/useOrganization";
import { ApiError, orgsApi } from "@/lib/api";

type Status = "idle" | "accepting" | "success" | "error";

export default function AcceptInvitePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  // Require auth so we can attribute the membership to the signed-in user.
  const { isAuthenticated, loading } = useAuth({ required: true });
  const acceptInvite = useAcceptInvite();

  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string>("");
  const attempted = useRef(false);

  useEffect(() => {
    if (loading || !isAuthenticated || attempted.current) return;
    attempted.current = true;

    if (!token) {
      setStatus("error");
      setMessage("This invite link is missing its token.");
      return;
    }

    const run = async () => {
      setStatus("accepting");
      try {
        const response = await acceptInvite.mutateAsync(token);
        const orgId = response.data?.membership.organizationId;
        setStatus("success");
        setMessage("You've joined the organization.");

        // Resolve the org slug for a friendly redirect.
        if (orgId) {
          try {
            const orgs = await orgsApi.list();
            const joined = orgs.find((o) => o.id === orgId);
            if (joined) {
              setTimeout(() => router.replace(`/orgs/${joined.slug}`), 1200);
              return;
            }
          } catch {
            // Fall through to the dashboard redirect below.
          }
        }
        setTimeout(() => router.replace("/dashboard"), 1200);
      } catch (err) {
        setStatus("error");
        setMessage(
          err instanceof ApiError
            ? err.message
            : "This invite is invalid or has expired.",
        );
      }
    };

    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, isAuthenticated, token]);

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center gap-4 text-center">
      {status === "idle" || status === "accepting" || loading ? (
        <>
          <Spinner className="size-8" />
          <p className="text-sm text-muted-foreground">Accepting your invite…</p>
        </>
      ) : status === "success" ? (
        <>
          <CheckCircle2 className="size-12 text-primary" />
          <h1 className="text-xl font-semibold">Welcome aboard!</h1>
          <p className="text-sm text-muted-foreground">{message}</p>
          <Spinner className="size-4" />
        </>
      ) : (
        <>
          <XCircle className="size-12 text-destructive" />
          <h1 className="text-xl font-semibold">Invite failed</h1>
          <p className="text-sm text-muted-foreground">{message}</p>
          <Button variant="outline" className="mt-2" asChild>
            <a href="/dashboard">Back to dashboard</a>
          </Button>
        </>
      )}
    </div>
  );
}
