"use client";

import { Code2 } from "lucide-react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

// GitHub mark. Inlined because lucide-react no longer ships brand icons.
function GithubIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5A11.5 11.5 0 0 0 .5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.2 1.77 1.2 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.56-.29-5.25-1.28-5.25-5.7 0-1.26.45-2.29 1.2-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.75.81 1.2 1.84 1.2 3.1 0 4.43-2.69 5.4-5.26 5.69.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12 11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  );
}

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/hooks/useAuth";

const ERROR_MESSAGES: Record<string, string> = {
  OAuthSignin: "Could not start GitHub sign-in. Please try again.",
  OAuthCallback: "GitHub sign-in failed during callback. Please try again.",
  OAuthAccountNotLinked:
    "This email is already linked to a different sign-in method.",
  AccessDenied: "Access was denied. Please try again.",
  Configuration: "Authentication is misconfigured. Contact an administrator.",
  Default: "Something went wrong while signing in. Please try again.",
};

function LoginCard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, loading } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const errorCode = searchParams.get("error");
  const errorMessage = errorCode
    ? (ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.Default)
    : null;

  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [loading, isAuthenticated, router]);

  const handleSignIn = () => {
    setSubmitting(true);
    void signIn("github", { callbackUrl: "/dashboard" });
  };

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="items-center text-center">
        <div className="mb-2 flex size-12 items-center justify-center rounded-xl bg-primary/10">
          <Code2 className="size-6 text-primary" />
        </div>
        <CardTitle className="text-xl">Sign in to DevCollab</CardTitle>
        <CardDescription>
          Collaborate on code in real time. Sign in with GitHub to continue.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {errorMessage ? (
          <p
            role="alert"
            className="rounded-md bg-destructive/10 px-3 py-2 text-center text-sm text-destructive"
          >
            {errorMessage}
          </p>
        ) : null}

        <Button
          className="w-full"
          onClick={handleSignIn}
          disabled={submitting || loading}
        >
          {submitting ? (
            <Spinner className="text-primary-foreground" />
          ) : (
            <GithubIcon />
          )}
          Sign in with GitHub
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          By continuing you agree to collaborate responsibly.
        </p>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Suspense
        fallback={
          <div className="flex items-center gap-2 text-muted-foreground">
            <Spinner /> Loading…
          </div>
        }
      >
        <LoginCard />
      </Suspense>
    </main>
  );
}
