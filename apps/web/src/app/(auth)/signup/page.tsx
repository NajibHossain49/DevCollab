"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/hooks/useAuth";

import { AuthShell, GithubIcon } from "../_components/auth-shell";
import { PasswordInput } from "../_components/password-input";

interface RegisterErrorBody {
  error?: { message?: string; details?: Record<string, string[]> };
}

const MIN_PASSWORD_LENGTH = 8;

function SignupCard() {
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [githubSubmitting, setGithubSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [loading, isAuthenticated, router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setFormError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as RegisterErrorBody;
        const firstDetail = body.error?.details
          ? Object.values(body.error.details).flat()[0]
          : undefined;
        setFormError(
          firstDetail ??
            body.error?.message ??
            "Could not create your account. Please try again.",
        );
        setSubmitting(false);
        return;
      }

      // Account created — sign the user straight in with their credentials.
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        // Account exists but sign-in failed; send them to login to retry.
        router.replace("/login");
        return;
      }

      router.replace("/dashboard");
    } catch {
      setFormError("Could not reach the server. Please try again.");
      setSubmitting(false);
    }
  };

  const handleGithubSignIn = () => {
    setGithubSubmitting(true);
    void signIn("github", { callbackUrl: "/dashboard" });
  };

  const busy = submitting || githubSubmitting || loading;

  return (
    <>
      <div className="text-center">
        <h1 className="text-xl font-semibold tracking-tight">
          Create your account
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Start collaborating with your team in minutes.
        </p>
      </div>

      {formError ? (
        <p
          role="alert"
          className="mt-6 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {formError}
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Full name</Label>
          <Input
            id="name"
            type="text"
            autoComplete="name"
            placeholder="Ada Lovelace"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={busy}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={busy}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={MIN_PASSWORD_LENGTH}
            required
            disabled={busy}
          />
        </div>

        <Button type="submit" className="w-full" disabled={busy}>
          {submitting ? <Spinner className="text-primary-foreground" /> : null}
          Create account
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">or continue with</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <Button
        variant="outline"
        className="w-full"
        onClick={handleGithubSignIn}
        disabled={busy}
      >
        {githubSubmitting ? <Spinner /> : <GithubIcon />}
        GitHub
      </Button>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </>
  );
}

export default function SignupPage() {
  return (
    <AuthShell>
      <SignupCard />
    </AuthShell>
  );
}
