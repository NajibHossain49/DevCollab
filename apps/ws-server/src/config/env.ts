import dotenv from "dotenv";
import { z } from "zod";

// Load variables from a local .env file (no-op in environments that inject
// real env vars, e.g. production hosts).
dotenv.config();

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),

  // Redis
  REDIS_URL: z.string().url(),

  // Auth
  GITHUB_CLIENT_ID: z.string().min(1),
  GITHUB_CLIENT_SECRET: z.string().min(1),
  NEXTAUTH_SECRET: z.string().min(32),
  NEXTAUTH_URL: z.string().url(),

  // Additional browser origins allowed by CORS, comma-separated. Used for the
  // deployed frontend URL(s), e.g. the Vercel domain(s).
  CORS_ORIGINS: z.string().optional(),

  // Server
  PORT: z.coerce.number().int().positive().default(3001),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // AI
  GROQ_API_KEY: z.string().optional(),

  // Email (SendGrid — free tier, 100 emails/day)
  // Leave SENDGRID_API_KEY empty to disable outbound email; invites still work
  // and return a shareable link that can be sent manually.
  SENDGRID_API_KEY: z.string().optional(),
  SENDGRID_FROM_EMAIL: z.string().email().optional(),
  SENDGRID_FROM_NAME: z.string().default("DevCollab"),
  // Max emails to send per calendar day (SendGrid free tier is 100/day).
  SENDGRID_DAILY_LIMIT: z.coerce.number().int().positive().default(100),

  // Public base URL of the web frontend, used to build invite links
  // (e.g. https://devcollab.vercel.app). Falls back to NEXTAUTH_URL.
  WEB_APP_URL: z.string().url().optional(),

  // Billing (Stripe). Use test-mode keys for now; swapping in live keys
  // later flips this to real charges without code changes. All optional so
  // the server boots (with billing disabled) when unset.
  STRIPE_SECRET_KEY: z.string().optional(),
  // Signing secret for the Stripe webhook endpoint (whsec_...).
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  // Price ID of the recurring "Pro" plan (price_...), created in Stripe.
  STRIPE_PRO_PRICE_ID: z.string().optional(),

  // Code Execution (Codex API by Jaagrav)
  // Base URL of the Codex code-execution API. The public instance requires no
  // key; override only if you self-host Codex.
  CODEX_API_URL: z.string().url().default("https://api.codex.jaagrav.in/"),

  // Logging
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const details = parsed.error.flatten().fieldErrors;
    const formatted = Object.entries(details)
      .map(([key, messages]) => `  - ${key}: ${(messages ?? []).join(", ")}`)
      .join("\n");

    throw new Error(
      `Invalid environment variables:\n${formatted}\n` +
        "Check your .env file against apps/ws-server/.env.example.",
    );
  }

  return parsed.data;
}

export const env: Env = loadEnv();
