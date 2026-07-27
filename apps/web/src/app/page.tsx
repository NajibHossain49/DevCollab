import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">DevCollab</h1>
      <p className="max-w-md text-muted-foreground">
        Real-time collaborative code editor with live cursors, AI assistance, and
        instant code execution.
      </p>
      <Link
        href="/login"
        className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        Get started
      </Link>
    </main>
  );
}
