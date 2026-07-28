import { startServer } from "./app.js";
import { validateAuthSecret } from "./config/auth-check.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";

async function main(): Promise<void> {
  // Fail fast if the shared auth secret is missing/placeholder so WebSocket
  // JWT verification against the web app doesn't silently break later.
  validateAuthSecret();

  await startServer();
  logger.info(`Server running on port ${env.PORT}`);
  logger.info("WebSocket server ready on /ws");
}

main().catch((error: unknown) => {
  logger.error({ error }, "Failed to start server");
  process.exit(1);
});
