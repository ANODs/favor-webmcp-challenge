-- CreateEnum
CREATE TYPE "AccountRestrictionScope" AS ENUM ('all_writes', 'contract_publish', 'deal_create', 'communication', 'support', 'login_lock');

-- CreateEnum
CREATE TYPE "AccountRestrictionSource" AS ENUM ('manual', 'automatic');

-- CreateEnum
CREATE TYPE "SupportTicketStatus" AS ENUM ('queued', 'delivered', 'needs_review', 'suppressed', 'failed', 'closed');

-- AlterTable
ALTER TABLE "Contract" ADD COLUMN "contentFingerprint" TEXT;

-- CreateIndex
CREATE INDEX "Contract_authorId_contentFingerprint_createdAt_idx" ON "Contract"("authorId", "contentFingerprint", "createdAt");

-- CreateTable
CREATE TABLE "AccountRestriction" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "scope" "AccountRestrictionScope" NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "publicMessage" TEXT NOT NULL,
    "internalComment" TEXT,
    "source" "AccountRestrictionSource" NOT NULL DEFAULT 'manual',
    "createdByModeratorId" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedByModeratorId" INTEGER,
    "revokeComment" TEXT,
    "evidence" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountRestriction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountModerationEvent" (
    "id" SERIAL NOT NULL,
    "targetUserId" INTEGER NOT NULL,
    "actorUserId" INTEGER NOT NULL,
    "restrictionId" INTEGER,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountModerationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AbuseCounter" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "windowStartedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AbuseCounter_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "ProcessedTelegramUpdate" (
    "updateId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedTelegramUpdate_pkey" PRIMARY KEY ("updateId")
);

-- CreateTable
CREATE TABLE "AdRewardEvent" (
    "eventId" TEXT NOT NULL,
    "telegramId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdRewardEvent_pkey" PRIMARY KEY ("eventId")
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" SERIAL NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" INTEGER,
    "reporterTelegramId" BIGINT NOT NULL,
    "source" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "descriptionHash" TEXT NOT NULL,
    "contact" JSONB,
    "photoFileIds" JSONB,
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "status" "SupportTicketStatus" NOT NULL DEFAULT 'queued',
    "telegramSupportMessageId" BIGINT,
    "deliveryError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccountRestriction_userId_revokedAt_expiresAt_idx" ON "AccountRestriction"("userId", "revokedAt", "expiresAt");

-- CreateIndex
CREATE INDEX "AccountRestriction_createdByModeratorId_createdAt_idx" ON "AccountRestriction"("createdByModeratorId", "createdAt");

-- CreateIndex
CREATE INDEX "AccountModerationEvent_targetUserId_createdAt_idx" ON "AccountModerationEvent"("targetUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AccountModerationEvent_actorUserId_createdAt_idx" ON "AccountModerationEvent"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AbuseCounter_expiresAt_idx" ON "AbuseCounter"("expiresAt");

-- CreateIndex
CREATE INDEX "ProcessedTelegramUpdate_createdAt_idx" ON "ProcessedTelegramUpdate"("createdAt");

-- CreateIndex
CREATE INDEX "AdRewardEvent_telegramId_createdAt_idx" ON "AdRewardEvent"("telegramId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SupportTicket_sessionId_key" ON "SupportTicket"("sessionId");

-- CreateIndex
CREATE INDEX "SupportTicket_reporterTelegramId_createdAt_idx" ON "SupportTicket"("reporterTelegramId", "createdAt");

-- CreateIndex
CREATE INDEX "SupportTicket_descriptionHash_createdAt_idx" ON "SupportTicket"("descriptionHash", "createdAt");

-- CreateIndex
CREATE INDEX "SupportTicket_status_createdAt_idx" ON "SupportTicket"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "AccountRestriction" ADD CONSTRAINT "AccountRestriction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountRestriction" ADD CONSTRAINT "AccountRestriction_createdByModeratorId_fkey" FOREIGN KEY ("createdByModeratorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountRestriction" ADD CONSTRAINT "AccountRestriction_revokedByModeratorId_fkey" FOREIGN KEY ("revokedByModeratorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountModerationEvent" ADD CONSTRAINT "AccountModerationEvent_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountModerationEvent" ADD CONSTRAINT "AccountModerationEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountModerationEvent" ADD CONSTRAINT "AccountModerationEvent_restrictionId_fkey" FOREIGN KEY ("restrictionId") REFERENCES "AccountRestriction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
