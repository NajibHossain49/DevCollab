import { prisma } from "../src/config/database.js";
import { logger } from "../src/config/logger.js";

// Idempotent development seed. Extend as needed.
async function main(): Promise<void> {
  const user = await prisma.user.upsert({
    where: { githubId: "0" },
    update: {},
    create: {
      githubId: "0",
      email: "demo@devcollab.dev",
      name: "Demo User",
    },
  });

  logger.info({ userId: user.id }, "Seed complete");
}

main()
  .catch((error: unknown) => {
    logger.error({ error }, "Seed failed");
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
