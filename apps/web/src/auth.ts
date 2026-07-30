import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import { z } from "zod";

// The ws-server owns the database, so credential verification is delegated to
// its REST API. Keep this in sync with apps/ws-server auth routes.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

interface WsServerUser {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
}

// Auth.js v5 configuration. GitHub credentials are read from the
// AUTH_GITHUB_ID / AUTH_GITHUB_SECRET environment variables automatically.
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GitHub,
    Credentials({
      id: "credentials",
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(rawCredentials) {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) {
          return null;
        }

        // Server-to-server call (no CORS). Returns the DB user on success.
        const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
        });

        if (!res.ok) {
          return null;
        }

        const json = (await res.json()) as {
          success: boolean;
          data?: { user: WsServerUser };
        };
        const user = json.data?.user;
        if (!user) {
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.avatar,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    jwt({ token, account, profile }) {
      if (account?.access_token) {
        token.accessToken = account.access_token;
      }
      const githubId = (profile as { id?: string | number } | undefined)?.id;
      if (typeof githubId !== "undefined") {
        token.githubId = String(githubId);
      }
      return token;
    },
    session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub;
      }
      if (typeof token.githubId === "string") {
        session.user.githubId = token.githubId;
      }
      session.accessToken = typeof token.accessToken === "string" ? token.accessToken : undefined;
      return session;
    },
  },
});
