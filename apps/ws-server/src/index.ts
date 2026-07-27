import { startServer } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";

async function main(): Promise<void> {
  await startServer();
  logger.info(`Server running on port ${env.PORT}`);
  logger.info("WebSocket server ready on /ws");
}

main().catch((error: unknown) => {
  logger.error({ error }, "Failed to start server");
  process.exit(1);
});
