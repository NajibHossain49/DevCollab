"use client";

import { useEffect } from "react";

import { warmBackends } from "@/lib/warmup";

// Wakes the Render free-tier backends in the background: once on mount, and
// again whenever the tab regains focus/visibility (covers the common case of a
// user returning after the services have gone to sleep). Renders nothing.
export function WarmupManager() {
  useEffect(() => {
    warmBackends();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") warmBackends();
    };

    window.addEventListener("focus", warmBackends);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("focus", warmBackends);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  return null;
}
