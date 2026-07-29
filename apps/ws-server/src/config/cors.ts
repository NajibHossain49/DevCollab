import type { CorsOptions } from "cors";

import { env } from "./env.js";
import { logger } from "./logger.js";

// Origins that are always allowed regardless of environment so local
// development keeps working even against a production-style config.
const LOCAL_DEV_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"];

// Builds the allow-list from:
//   - local dev URLs (always)
//   - NEXTAUTH_URL (the app's public base URL)
//   - CORS_ORIGINS (comma-separated deployed frontend URLs, e.g. Vercel)
function buildAllowedOrigins(): string[] {
  const fromEnv = (env.CORS_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  return [...new Set([...LOCAL_DEV_ORIGINS, env.NEXTAUTH_URL, ...fromEnv])];
}

const allowedOrigins: string[] = buildAllowedOrigins();

logger.info({ allowedOrigins }, "CORS allow-list initialized");

export const corsOptions: CorsOptions = {
  // Dynamic origin check: allow same-origin/non-browser requests (no Origin
  // header) and any origin present in the allow-list; reject everything else.
  origin(origin, callback): void {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    logger.warn({ origin }, "Blocked by CORS");
    callback(new Error(`Origin not allowed by CORS: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};
