"use client";

import { SessionProvider, useSession } from "next-auth/react";
import { useEffect, type ReactNode } from "react";

import { clearAuthToken } from "@/lib/api";

// Drops the API client's cached JWT whenever the signed-in user changes (login,
// logout, or account switch) so the next request mints a token for the right
// user. The token itself is fetched lazily from /api/ws-token by the API
// client, so there is nothing to push in here.
function TokenSync() {
  const { data: session, status } = useSession();
  const userId = session?.user?.id;

  useEffect(() => {
    if (status !== "loading") {
      clearAuthToken();
    }
  }, [status, userId]);

  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <TokenSync />
      {children}
    </SessionProvider>
  );
}
