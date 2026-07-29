// Fire-and-forget warm-up pings for Render free-tier services, which sleep
// after ~15 min of inactivity and then take ~30-60s to cold-start. Pinging the
// backends when the user opens (or returns to) the app lets them wake in the
// background, so they're ready by the time the user actually runs code.
//
// All requests are best-effort: failures, CORS, and timeouts are ignored — the
// only goal is to hit the server and trigger a wake-up.

const WS_SERVER_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, "");
// Optional: the self-hosted code-execution service. If unset, it simply won't
// be pre-warmed (it will still cold-start on first run).
const CODEX_URL = (process.env.NEXT_PUBLIC_CODEX_URL ?? "").replace(/\/+$/, "");

// Throttle so rapid focus/visibility toggles don't spam the servers.
const MIN_INTERVAL_MS = 60_000;
let lastWarmedAt = 0;

function ping(url: string): void {
  if (!url) return;
  // `no-cors` keeps this from ever throwing a CORS error; we don't need to read
  // the response, only to reach the server and wake it.
  void fetch(url, {
    method: "GET",
    cache: "no-store",
    mode: "no-cors",
    keepalive: true,
  }).catch(() => {
    // Intentionally ignored — warm-up is purely opportunistic.
  });
}

// Pings the backends unless we pinged very recently. Safe to call often.
export function warmBackends(): void {
  if (typeof window === "undefined") return;

  const now = Date.now();
  if (now - lastWarmedAt < MIN_INTERVAL_MS) return;
  lastWarmedAt = now;

  if (WS_SERVER_URL) ping(`${WS_SERVER_URL}/health`);
  if (CODEX_URL) ping(`${CODEX_URL}/status`);
}
