-- CreateEnum
CREATE TYPE "GitProvider" AS ENUM ('GITHUB', 'GITLAB', 'BITBUCKET');

-- CreateEnum
CREATE TYPE "PRStatus" AS ENUM ('OPEN', 'CLOSED', 'MERGED');

-- AlterTable
ALTER TABLE "rooms" ADD COLUMN     "gitRepoId" TEXT;

-- CreateTable
CREATE TABLE "git_integrations" (
    "id" TEXT NOT NULL,
    "provider" "GitProvider" NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "accountLogin" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "ownerId" TEXT NOT NULL,
    "orgId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "git_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "git_repos" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "providerRepoId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "defaultBranch" TEXT NOT NULL DEFAULT 'main',
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "isLinked" BOOLEAN NOT NULL DEFAULT false,
    "linkedRoomId" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "git_repos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pull_requests" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "provider" "GitProvider" NOT NULL,
    "prNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "branchFrom" TEXT NOT NULL,
    "branchTo" TEXT NOT NULL,
    "status" "PRStatus" NOT NULL DEFAULT 'OPEN',
    "url" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pull_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "git_integrations_ownerId_idx" ON "git_integrations"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "git_integrations_provider_ownerId_key" ON "git_integrations"("provider", "ownerId");

-- CreateIndex
CREATE INDEX "git_repos_integrationId_idx" ON "git_repos"("integrationId");

-- CreateIndex
CREATE INDEX "git_repos_linkedRoomId_idx" ON "git_repos"("linkedRoomId");

-- CreateIndex
CREATE UNIQUE INDEX "git_repos_integrationId_providerRepoId_key" ON "git_repos"("integrationId", "providerRepoId");

-- CreateIndex
CREATE INDEX "pull_requests_roomId_idx" ON "pull_requests"("roomId");

-- CreateIndex
CREATE INDEX "rooms_gitRepoId_idx" ON "rooms"("gitRepoId");

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_gitRepoId_fkey" FOREIGN KEY ("gitRepoId") REFERENCES "git_repos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "git_integrations" ADD CONSTRAINT "git_integrations_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "git_integrations" ADD CONSTRAINT "git_integrations_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "git_repos" ADD CONSTRAINT "git_repos_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "git_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "git_repos" ADD CONSTRAINT "git_repos_linkedRoomId_fkey" FOREIGN KEY ("linkedRoomId") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pull_requests" ADD CONSTRAINT "pull_requests_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
