"use client";

import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function RoomError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[room/error]", error);
  }, [error]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 rounded-lg border border-border p-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="size-6 text-destructive" />
      </div>
      <div className="space-y-1">
        <h2 className="font-semibold">This room hit a snag</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          {error.message ||
            "The collaborative session failed to load. You can retry or head back."}
        </p>
      </div>
      <div className="flex gap-2">
        <Button onClick={reset}>Reload room</Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard">Back to rooms</Link>
        </Button>
      </div>
    </div>
  );
}
