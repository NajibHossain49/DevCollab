"use client";

import { useEffect } from "react";

// Catches errors thrown in the root layout itself. Must render its own
// <html>/<body> because it replaces the entire document on failure.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          fontFamily: "system-ui, sans-serif",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: "1.25rem", fontWeight: 600 }}>
          Something went wrong
        </h1>
        <p style={{ color: "#71717a", maxWidth: "28rem" }}>
          {error.message || "A critical error occurred."}
        </p>
        <button
          onClick={reset}
          style={{
            borderRadius: "0.375rem",
            background: "#18181b",
            color: "white",
            padding: "0.5rem 1.25rem",
            fontSize: "0.875rem",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
