-- CreateEnum
CREATE TYPE "OrgPlan" AS ENUM ('FREE', 'PRO');

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "plan" "OrgPlan" NOT NULL DEFAULT 'FREE',
ADD COLUMN     "stripeCustomerId" TEXT,
ADD COLUMN     "stripeSubscriptionId" TEXT,
ADD COLUMN     "stripePriceId" TEXT,
ADD COLUMN     "subscriptionStatus" TEXT,
ADD COLUMN     "currentPeriodEnd" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_stripeCustomerId_key" ON "organizations"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_stripeSubscriptionId_key" ON "organizations"("stripeSubscriptionId");
