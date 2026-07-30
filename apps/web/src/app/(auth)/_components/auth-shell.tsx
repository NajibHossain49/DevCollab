import { Code2 } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

// GitHub mark. Inlined because lucide-react no longer ships brand icons.
export function GithubIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5A11.5 11.5 0 0 0 .5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.2 1.77 1.2 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.56-.29-5.25-1.28-5.25-5.7 0-1.26.45-2.29 1.2-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.75.81 1.2 1.84 1.2 3.1 0 4.43-2.69 5.4-5.26 5.69.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12 11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  );
}

// Faint neutral dotted backdrop, faded toward the edges. Monochrome — no
// colored gradients, keeping the auth screens calm and product-focused.
const DOT_GRID_STYLE = {
  backgroundImage:
    "radial-gradient(color-mix(in oklch, var(--color-muted-foreground) 16%, transparent) 1px, transparent 1px)",
  backgroundSize: "22px 22px",
  maskImage:
    "radial-gradient(ellipse 60% 55% at 50% 45%, #000 15%, transparent 80%)",
  WebkitMaskImage:
    "radial-gradient(ellipse 60% 55% at 50% 45%, #000 15%, transparent 80%)",
} as const;

// Centered, minimal auth layout shared by the login and sign-up pages.
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-10">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10" style={DOT_GRID_STYLE} />

      <div className="w-full max-w-100">
        <div className="mb-6 flex justify-center">
          <Link href="/" className="inline-flex items-center gap-2 font-semibold">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Code2 className="size-5" />
            </span>
            <span className="text-lg tracking-tight">DevCollab</span>
          </Link>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          {children}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          By continuing you agree to our{" "}
          <Link
            href="/"
            className="underline underline-offset-4 transition-colors hover:text-foreground"
          >
            Terms
          </Link>{" "}
          &amp;{" "}
          <Link
            href="/"
            className="underline underline-offset-4 transition-colors hover:text-foreground"
          >
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
