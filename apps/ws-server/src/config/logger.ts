import pino, { type Logger } from "pino";

import { env } from "./env.js";

const isDevelopment = env.NODE_ENV === "development";

export const logger: Logger = pino({
  level: env.LOG_LEVEL,
  // Pretty, colorized output in development; structured JSON everywhere else.
  transport: isDevelopment
    ? { target: "pino-pretty", options: { colorize: true } }
    : undefined,
  base: { pid: process.pid, env: env.NODE_ENV },
});
