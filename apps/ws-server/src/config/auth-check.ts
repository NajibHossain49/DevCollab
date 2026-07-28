import { createHash } from "node:crypto";

import { env } from "./env.js";
import { logger } from "./logger.js";

// Values shipped in .env.example that must never be used at runtime.
const PLACEHOLDER_SECRETS = new Set([
  "replace_with_a_random_secret_at_least_32_chars",
  "your_nextauth_secret",
  "changeme",
]);

// Short, non-reversible fingerprint of a secret. Both this server and the web
// app log the same fingerprint on startup so operators can confirm the values
// match without ever exposing the secret itself.
export function authSecretFingerprint(secret: string): string {
  return createHash("sha256").update(secret).digest("hex").slice(0, 12);
}

// Validates NEXTAUTH_SECRET on startup. The web app signs WebSocket JWTs with
// its AUTH_SECRET, and this server verifies them with NEXTAUTH_SECRET, so the
// two MUST be identical. This process cannot read the web app's env directly,
// hence the comparable fingerprint log line.
export function validateAuthSecret(): void {
  const secret = env.NEXTAUTH_SECRET;

  if (PLACEHOLDER_SECRETS.has(secret)) {
    throw new Error(
      "NEXTAUTH_SECRET is still set to an example placeholder. Set it to a real " +
        "secret that is identical to the web app's AUTH_SECRET.",
    );
  }

  logger.info(
    { authSecretFingerprint: authSecretFingerprint(secret) },
    "Auth secret loaded — this fingerprint MUST match the web app's AUTH_SECRET fingerprint",
  );
}
