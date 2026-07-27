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

  // Server
  PORT: z.coerce.number().int().positive().default(3001),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // AI
  OLLAMA_URL: z.string().url().default("http://localhost:11434"),
  GROQ_API_KEY: z.string().optional(),

  // Code Execution (Judge0)
  JUDGE0_API_URL: z.string().url(),
  JUDGE0_API_KEY: z.string().min(1),

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
