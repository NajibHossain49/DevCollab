"use client";

import {
  ArrowRight,
  Check,
  Code2,
  Cpu,
  MessageSquare,
  Play,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Reveal } from "@/components/landing/Reveal";
import { SmoothScroll } from "@/components/landing/SmoothScroll";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

const FEATURES = [
  {
    icon: Users,
    title: "Real-time collaboration",
    description:
      "Edit the same file together with instant sync. Everyone sees every keystroke as it happens — no refresh, no conflicts.",
  },
  {
    icon: Sparkles,
    title: "AI assistance",
    description:
      "Get inline completions and one-click code explanations powered by AI, right inside the editor.",
  },
  {
    icon: Play,
    title: "Instant code execution",
    description:
      "Run JavaScript, TypeScript, Python, Java, C++, Go and Rust in the browser and see output in seconds.",
  },
  {
    icon: MessageSquare,
    title: "Built-in chat",
    description:
      "Discuss ideas without leaving the room. Presence and live cursors show who is doing what, where.",
  },
  {
    icon: ShieldCheck,
    title: "Secure GitHub auth",
    description:
      "Sign in with GitHub. Every room and execution is scoped to authenticated members you invite.",
  },
  {
    icon: Cpu,
    title: "Multi-language runtimes",
    description:
      "A self-hosted execution engine runs seven languages with sensible timeouts and clean output.",
  },
];

const STEPS = [
  {
    step: "01",
    title: "Sign in with GitHub",
    description: "One click to authenticate — no forms, no passwords.",
  },
  {
    step: "02",
    title: "Create or join a room",
    description: "Pick a language, invite teammates, and start editing together.",
  },
  {
    step: "03",
    title: "Code, run, ship",
    description: "Write, run, and review in real time with AI at your side.",
  },
];

interface Plan {
  name: string;
  tagline: string;
  monthly: number;
  annual: number;
  features: string[];
  cta: string;
  highlighted?: boolean;
}

const PLANS: Plan[] = [
  {
    name: "Free",
    tagline: "For trying things out and small hobby sessions.",
    monthly: 0,
    annual: 0,
    features: [
      "Up to 3 rooms",
      "2 collaborators per room",
      "All language runtimes",
      "Community support",
    ],
    cta: "Get started",
  },
  {
    name: "Pro",
    tagline: "For developers who pair and build every day.",
    monthly: 12,
    annual: 9,
    features: [
      "Unlimited rooms",
      "10 collaborators per room",
      "AI completions & explanations",
      "Execution history",
      "Priority code execution",
    ],
    cta: "Upgrade to Pro",
    highlighted: true,
  },
  {
    name: "Team",
    tagline: "For teams that collaborate at scale.",
    monthly: 39,
    annual: 29,
    features: [
      "Everything in Pro",
      "Unlimited collaborators",
      "Admin & role controls",
      "SSO (coming soon)",
      "Priority support",
    ],
    cta: "Start Team trial",
  },
];

const FAQS = [
  {
    q: "Is there really a free plan?",
    a: "Yes. The Free plan lets you create rooms, collaborate, and run code in every supported language — no credit card required.",
  },
  {
    q: "Which languages can I run?",
    a: "JavaScript, TypeScript, Python, Java, C++, Go and Rust, executed by our own self-hosted runtime.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Absolutely. Paid plans are month-to-month (or annual) and you can cancel or switch plans whenever you like.",
  },
  {
    q: "How does real-time editing work?",
    a: "We use conflict-free replicated data types (CRDTs) so multiple people can edit the same document simultaneously without stepping on each other.",
  },
];

// Gradient used across CTAs and accents.
const GRADIENT = "bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500";

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-semibold">
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
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button
            asChild
            size="sm"
            className={cn("text-white hover:opacity-90", GRADIENT)}
          >
            <Link href="/signup">Get started</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Dotted grid backdrop */}
      <div aria-hidden className="bg-grid pointer-events-none absolute inset-0 -z-20" />
      {/* Ambient gradient blobs */}
      <div
        aria-hidden
        className="animate-glow pointer-events-none absolute -left-20 -top-24 -z-10 size-96 rounded-full blur-3xl"
        style={{
          background: "radial-gradient(closest-side, oklch(0.6 0.24 280), transparent)",
        }}
      />
      <div
        aria-hidden
        className="animate-glow pointer-events-none absolute -right-20 top-10 -z-10 size-96 rounded-full blur-3xl"
        style={{
          background: "radial-gradient(closest-side, oklch(0.65 0.25 340), transparent)",
          animationDelay: "2s",
        }}
      />
      <div className="mx-auto max-w-6xl px-4 pb-16 pt-20 text-center sm:px-6 sm:pt-28">
        <Reveal>
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="size-3.5 text-violet-500" />
            Now with AI-assisted pair programming
          </div>
        </Reveal>
        <Reveal delay={80}>
          <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
            Code together,{" "}
            <span
              className={cn(
                "animate-gradient bg-clip-text text-transparent",
                GRADIENT,
              )}
            >
              in real time
            </span>
          </h1>
        </Reveal>
        <Reveal delay={160}>
          <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
            DevCollab is a collaborative code editor with live cursors, built-in
            chat, AI assistance, and instant multi-language execution — all in
            your browser.
          </p>
        </Reveal>
        <Reveal delay={240}>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className={cn(
                "group text-white shadow-lg shadow-violet-500/25 transition-all hover:opacity-90 hover:shadow-violet-500/40",
                GRADIENT,
              )}
            >
              <Link href="/signup">
                Start for free
                <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#pricing">View pricing</a>
            </Button>
          </div>
        </Reveal>
        <Reveal delay={300}>
          <p className="mt-4 text-xs text-muted-foreground">
            Free forever plan · No credit card required
          </p>
        </Reveal>

        <Reveal delay={360}>
          <div className="animate-float">
            <HeroPreview />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function HeroPreview() {
  const collaborators = [
    { name: "AK", color: "bg-indigo-500" },
    { name: "NH", color: "bg-fuchsia-500" },
    { name: "RS", color: "bg-emerald-500" },
  ];
  const codeLines = [
    "function greet(name: string) {",
    '  return `Hello, ${name}!`;',
    "}",
    "",
    "console.log(greet('DevCollab'));",
  ];

  return (
    <div className="mx-auto mt-14 max-w-4xl">
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-2xl shadow-black/5">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <span className="size-3 rounded-full bg-red-400" />
          <span className="size-3 rounded-full bg-amber-400" />
          <span className="size-3 rounded-full bg-emerald-400" />
          <span className="ml-3 text-xs text-muted-foreground">
            main.ts — DevCollab room
          </span>
          <div className="ml-auto flex -space-x-2">
            {collaborators.map((c) => (
              <span
                key={c.name}
                className={cn(
                  "flex size-6 items-center justify-center rounded-full border-2 border-card text-[10px] font-semibold text-white",
                  c.color,
                )}
              >
                {c.name}
              </span>
            ))}
          </div>
        </div>
        <div className="grid gap-0 sm:grid-cols-[1fr_auto]">
          <pre className="overflow-x-auto p-5 text-left font-mono text-xs leading-6 sm:text-sm">
            {codeLines.map((line, i) => (
              <div key={i} className="flex gap-4">
                <span className="select-none text-muted-foreground/50">
                  {i + 1}
                </span>
                <code className="text-foreground/90">{line || " "}</code>
              </div>
            ))}
          </pre>
          <div className="hidden w-48 flex-col gap-2 border-l border-border p-4 text-left sm:flex">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Output
            </p>
            <div className="rounded-md bg-muted/60 p-2 font-mono text-xs">
              Hello, DevCollab!
            </div>
            <div className="mt-auto flex items-center gap-1.5 text-xs text-emerald-500">
              <Zap className="size-3.5" /> Ran in 0.4s
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
      <Reveal className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Everything you need to build together
        </h2>
        <p className="mt-4 text-muted-foreground">
          A complete collaborative environment — from live editing to running
          code — without stitching together five different tools.
        </p>
      </Reveal>
      <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature, i) => (
          <Reveal key={feature.title} delay={(i % 3) * 90}>
            <div className="group h-full rounded-xl border border-border bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-violet-500/40 hover:shadow-lg hover:shadow-violet-500/5">
              <div
                className={cn(
                  "mb-4 flex size-10 items-center justify-center rounded-lg text-white transition-transform duration-300 group-hover:scale-110",
                  GRADIENT,
                )}
              >
                <feature.icon className="size-5" />
              </div>
              <h3 className="font-semibold">{feature.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {feature.description}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section className="border-y border-border bg-muted/30">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Up and running in seconds
          </h2>
        </Reveal>
        <div className="mt-14 grid gap-8 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <Reveal key={step.step} delay={i * 120} className="text-center">
              <span
                className={cn(
                  "mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-clip-text text-2xl font-bold text-transparent",
                  GRADIENT,
                )}
              >
                {step.step}
              </span>
              <h3 className="font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {step.description}
              </p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  const [annual, setAnnual] = useState(true);

  return (
    <section id="pricing" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
      <Reveal className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Simple, transparent pricing
        </h2>
        <p className="mt-4 text-muted-foreground">
          Start free. Upgrade when your team grows. Cancel anytime.
        </p>

        <div className="mt-8 inline-flex items-center gap-3 rounded-full border border-border bg-muted/50 p-1 text-sm">
          <button
            type="button"
            onClick={() => setAnnual(false)}
            className={cn(
              "rounded-full px-4 py-1.5 font-medium transition-colors",
              !annual ? "bg-background shadow-sm" : "text-muted-foreground",
            )}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setAnnual(true)}
            className={cn(
              "flex items-center gap-2 rounded-full px-4 py-1.5 font-medium transition-colors",
              annual ? "bg-background shadow-sm" : "text-muted-foreground",
            )}
          >
            Annual
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-600 dark:text-emerald-400">
              Save 25%
            </span>
          </button>
        </div>
      </Reveal>

      <div className="mt-14 grid items-start gap-6 lg:grid-cols-3">
        {PLANS.map((plan, i) => {
          const price = annual ? plan.annual : plan.monthly;
          return (
            <Reveal key={plan.name} delay={i * 110} className="h-full">
            <div
              className={cn(
                "relative flex h-full flex-col rounded-2xl border bg-card p-6 transition-all duration-300 hover:shadow-xl",
                plan.highlighted
                  ? "border-violet-500/60 shadow-xl shadow-violet-500/10 hover:shadow-violet-500/20 lg:-translate-y-2"
                  : "border-border hover:-translate-y-1 hover:border-violet-500/40",
              )}
            >
              {plan.highlighted ? (
                <span
                  className={cn(
                    "absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-semibold text-white",
                    GRADIENT,
                  )}
                >
                  Most popular
                </span>
              ) : null}
              <h3 className="text-lg font-semibold">{plan.name}</h3>
              <p className="mt-1 min-h-10 text-sm text-muted-foreground">
                {plan.tagline}
              </p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold tracking-tight">
                  ${price}
                </span>
                <span className="text-sm text-muted-foreground">/month</span>
              </div>
              {annual && plan.monthly > 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  billed annually
                </p>
              ) : (
                <p className="mt-1 text-xs text-transparent">placeholder</p>
              )}

              <Button
                asChild
                className={cn(
                  "mt-6 w-full",
                  plan.highlighted && cn("text-white hover:opacity-90", GRADIENT),
                )}
                variant={plan.highlighted ? "default" : "outline"}
              >
                <Link href="/signup">{plan.cta}</Link>
              </Button>

              <ul className="mt-6 space-y-3 text-sm">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-violet-500" />
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-20 sm:px-6">
      <Reveal>
        <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
          Frequently asked questions
        </h2>
      </Reveal>
      <Reveal delay={100} className="mt-10">
        <div className="divide-y divide-border rounded-xl border border-border bg-card">
          {FAQS.map((faq) => (
            <details key={faq.q} className="group px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between font-medium transition-colors hover:text-violet-500">
                {faq.q}
                <span className="ml-4 text-lg text-muted-foreground transition-transform duration-300 group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm text-muted-foreground">{faq.a}</p>
            </details>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

function CtaBand() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
      <Reveal>
        <div
          className={cn(
            "relative overflow-hidden rounded-3xl px-6 py-16 text-center text-white",
            GRADIENT,
          )}
        >
          {/* Decorative glows */}
          <div
            aria-hidden
            className="animate-glow pointer-events-none absolute -left-10 -top-10 size-60 rounded-full bg-white/20 blur-3xl"
          />
          <div
            aria-hidden
            className="animate-glow pointer-events-none absolute -bottom-16 -right-10 size-60 rounded-full bg-white/20 blur-3xl"
            style={{ animationDelay: "3s" }}
          />
          <h2 className="relative mx-auto max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
            Ready to build together?
          </h2>
          <p className="relative mx-auto mt-4 max-w-lg text-white/80">
            Join developers pairing, teaching, and shipping in real time on
            DevCollab.
          </p>
          <Button
            asChild
            size="lg"
            className="relative mt-8 bg-white text-neutral-900 shadow-lg transition-transform hover:scale-105 hover:bg-white/90"
          >
            <Link href="/signup">
              Get started free
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </Reveal>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
        <Logo />
        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} DevCollab. All rights reserved.
        </p>
        <div className="flex gap-6 text-sm text-muted-foreground">
          <a href="#features" className="hover:text-foreground">
            Features
          </a>
          <a href="#pricing" className="hover:text-foreground">
            Pricing
          </a>
          <Link href="/login" className="hover:text-foreground">
            Sign in
          </Link>
        </div>
      </div>
    </footer>
  );
}

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SmoothScroll />
      <Nav />
      <main className="flex-1">
        <Hero />
        <Features />
        <HowItWorks />
        <Pricing />
        <Faq />
        <CtaBand />
      </main>
      <Footer />
    </div>
  );
}
