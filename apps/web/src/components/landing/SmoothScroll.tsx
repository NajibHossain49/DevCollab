"use client";

import Lenis from "lenis";
import { useEffect } from "react";

// Enables Lenis smooth scrolling for the page it is mounted on. Scoped to the
// marketing pages (not the editor/dashboard, where native scroll is expected).
// Handles in-page anchor links (#features, #pricing, …) with an offset for the
// sticky nav, and is disabled entirely under prefers-reduced-motion.
export function SmoothScroll() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReduced) return;

    const lenis = new Lenis({
      duration: 1.1,
      smoothWheel: true,
      // Ease that decelerates smoothly toward the target.
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      // Auto-intercept same-page anchor links; leave room for the 64px nav.
      anchors: { offset: -80 },
    });

    let rafId = requestAnimationFrame(function raf(time) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    });

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, []);

  return null;
}
