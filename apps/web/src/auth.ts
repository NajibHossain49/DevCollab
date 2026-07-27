import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

// Auth.js v5 configuration. GitHub credentials are read from the
// AUTH_GITHUB_ID / AUTH_GITHUB_SECRET environment variables automatically.
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [GitHub],
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
