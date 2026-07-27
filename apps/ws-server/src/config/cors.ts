import type { CorsOptions } from "cors";

import { env } from "./env.js";

// Allowed browser origins. NEXTAUTH_URL covers the deployed frontend; the
// localhost entry keeps local development working regardless of env value.
const allowedOrigins: string[] = [...new Set([env.NEXTAUTH_URL, "http://localhost:3000"])];

export const corsOptions: CorsOptions = {
  origin: allowedOrigins,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};
