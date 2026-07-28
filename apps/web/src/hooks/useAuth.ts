"use client";

import { signOut as nextAuthSignOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";

export interface AuthUser {
  id: string;
  name: string | null;
  email: string | null;
  avatar: string | null;
  githubId?: string;
}

interface UseAuthOptions {
  /** When true, unauthenticated users are redirected to the login page. */
  required?: boolean;
  /** Where to send the user after signing out. */
  signOutRedirect?: string;
}

interface UseAuthResult {
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  signOut: () => void;
}

// Central auth hook wrapping the Auth.js session. Use `{ required: true }` in
// protected areas to redirect anonymous users to /login.
export function useAuth(options: UseAuthOptions = {}): UseAuthResult {
  const { required = false, signOutRedirect = "/login" } = options;
  const { data: session, status } = useSession();
  const router = useRouter();

  const loading = status === "loading";
  const isAuthenticated = status === "authenticated";

  useEffect(() => {
    if (required && status === "unauthenticated") {
      router.replace("/login");
    }
  }, [required, status, router]);

  const user: AuthUser | null = session?.user
    ? {
        id: session.user.id,
        name: session.user.name ?? null,
        email: session.user.email ?? null,
        avatar: session.user.image ?? null,
        githubId: session.user.githubId,
      }
    : null;

  const signOut = useCallback(() => {
    void nextAuthSignOut({ callbackUrl: signOutRedirect });
  }, [signOutRedirect]);

  return { user, loading, isAuthenticated, signOut };
}
