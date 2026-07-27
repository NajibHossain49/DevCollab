"use client";

import { SessionProvider, useSession } from "next-auth/react";
import { useEffect, type ReactNode } from "react";

import { setAuthToken } from "@/lib/api";

// Keeps the API client's bearer token in sync with the active session.
function TokenSync() {
  const { data: session } = useSession();

  useEffect(() => {
    setAuthToken(session?.accessToken ?? null);
  }, [session?.accessToken]);

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
