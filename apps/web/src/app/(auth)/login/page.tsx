"use client";

import { ArrowLeft, Check, Code2, Sparkles } from "lucide-react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

// GitHub mark. Inlined because lucide-react no longer ships brand icons.
function GithubIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5A11.5 11.5 0 0 0 .5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.2 1.77 1.2 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.56-.29-5.25-1.28-5.25-5.7 0-1.26.45-2.29 1.2-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.75.81 1.2 1.84 1.2 3.1 0 4.43-2.69 5.4-5.26 5.69.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12 11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  );
}

const GRADIENT = "bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500";

const BENEFITS = [
  "Real-time collaborative editing with live cursors",
  "Run 7 languages instantly in the browser",
  "AI completions & one-click explanations",
  "Built-in chat and presence for your team",
];

const ERROR_MESSAGES: Record<string, string> = {
  OAuthSignin: "Could not start GitHub sign-in. Please try again.",
  OAuthCallback: "GitHub sign-in failed during callback. Please try again.",
  OAuthAccountNotLinked:
    "This email is already linked to a different sign-in method.",
  AccessDenied: "Access was denied. Please try again.",
  Configuration: "Authentication is misconfigured. Contact an administrator.",
  Default: "Something went wrong while signing in. Please try again.",
};

// Left marketing panel — hidden on small screens.
function BrandPanel() {
  return (
    <div
      className={cn(
        "relative hidden flex-col justify-between overflow-hidden p-10 text-white lg:flex",
        GRADIENT,
      )}
    >
      <Link href="/" className="flex items-center gap-2 font-semibold">
        <span className="flex size-8 items-center justify-center rounded-lg bg-white/15">
          <Code2 className="size-5" />
        </span>
        <span className="text-lg tracking-tight">DevCollab</span>
      </Link>

      <div className="max-w-md">
        <h1 className="text-3xl font-bold leading-tight">
          Where teams write code together.
        </h1>
        <ul className="mt-8 space-y-4">
          {BENEFITS.map((benefit) => (
            <li key={benefit} className="flex items-start gap-3">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-white/20">
                <Check className="size-3.5" />
              </span>
              <span className="text-white/90">{benefit}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl bg-white/10 p-5 backdrop-blur-sm">
        <p className="text-sm text-white/90">
          &ldquo;DevCollab replaced three tools in our interview and pairing
          workflow. Setup was instant.&rdquo;
        </p>
        <p className="mt-3 text-xs font-medium text-white/70">
          — A very happy engineering team
        </p>
      </div>

      {/* Decorative glows */}
      <div
        aria-hidden
        className="animate-glow pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-white/20 blur-3xl"
      />
      <div
        aria-hidden
        className="animate-glow pointer-events-none absolute -bottom-20 -left-16 size-64 rounded-full bg-white/15 blur-3xl"
        style={{ animationDelay: "2.5s" }}
      />
    </div>
  );
}

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
    <div className="mx-auto flex w-full max-w-sm flex-col">
      {/* Logo (shown on mobile where the brand panel is hidden) */}
      <Link
        href="/"
        className="mb-8 flex items-center gap-2 font-semibold lg:hidden"
      >
        <span
          className={cn(
            "flex size-8 items-center justify-center rounded-lg text-white",
            GRADIENT,
          )}
        >
          <Code2 className="size-5" />
        </span>
        <span className="text-lg tracking-tight">DevCollab</span>
      </Link>

      <div className="mb-2 inline-flex w-fit items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
        <Sparkles className="size-3.5 text-violet-500" />
        Free forever plan
      </div>

      <h2 className="text-2xl font-bold tracking-tight">Welcome back</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Sign in to your DevCollab account to start collaborating.
      </p>

      {errorMessage ? (
        <p
          role="alert"
          className="mt-6 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {errorMessage}
        </p>
      ) : null}

      <Button
        className="mt-6 w-full"
        size="lg"
        onClick={handleSignIn}
        disabled={submitting || loading}
      >
        {submitting ? (
          <Spinner className="text-primary-foreground" />
        ) : (
          <GithubIcon />
        )}
        Continue with GitHub
      </Button>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        By continuing you agree to collaborate responsibly.
      </p>

      <Link
        href="/"
        className="mt-8 inline-flex items-center justify-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to home
      </Link>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <BrandPanel />
      <div className="flex items-center justify-center p-6 sm:p-10">
        <Suspense
          fallback={
            <div className="flex items-center gap-2 text-muted-foreground">
              <Spinner /> Loading…
            </div>
          }
        >
          <LoginCard />
        </Suspense>
      </div>
    </main>
  );
}
