"use client";

import { useState, type HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  src?: string | null;
  alt?: string;
  /** Fallback text (usually the user's initials) shown when no image loads. */
  fallback?: string;
}

// Lightweight avatar: renders the image when available, otherwise falls back to
// initials. Avoids pulling in an extra Radix dependency.
export function Avatar({
  src,
  alt = "",
  fallback,
  className,
  ...props
}: AvatarProps) {
  const [errored, setErrored] = useState(false);
  const showImage = Boolean(src) && !errored;

  return (
    <span
      className={cn(
        "relative flex size-9 shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-medium text-muted-foreground",
        className,
      )}
      {...props}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src as string}
          alt={alt}
          className="aspect-square size-full object-cover"
          onError={() => setErrored(true)}
          referrerPolicy="no-referrer"
        />
      ) : (
        <span aria-hidden>{fallback ?? "?"}</span>
      )}
    </span>
  );
}

// Derives up-to-two uppercase initials from a display name.
export function initialsFromName(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "";
  const second = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + second).toUpperCase() || "?";
}
