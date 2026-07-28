// Next.js runs `register()` once when the server process boots. We use it to
// validate the auth secret and emit a fingerprint that must match the
// ws-server's startup log. We hash with the Web Crypto API (available in both
// the Node and Edge runtimes) so this file never imports `node:crypto`, which
// would break the Edge instrumentation build.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const secret = process.env.AUTH_SECRET;

  const placeholders = new Set([
    "replace_with_a_random_secret_at_least_32_chars",
    "your_nextauth_secret",
    "changeme",
  ]);

  if (!secret) {
    console.error(
      "[auth] AUTH_SECRET is not set — WebSocket tokens cannot be minted and sessions will fail.",
    );
    return;
  }

  if (placeholders.has(secret)) {
    console.warn(
      "[auth] AUTH_SECRET is an example placeholder — set a real value identical to the ws-server's NEXTAUTH_SECRET.",
    );
  }

  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(secret),
  );
  const fingerprint = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 12);

  console.info(
    `[auth] AUTH_SECRET fingerprint: ${fingerprint} — must match the ws-server's authSecretFingerprint.`,
  );
}
