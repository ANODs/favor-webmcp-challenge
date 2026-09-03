-- CreateEnum
CREATE TYPE "ContractQuestionStatus" AS ENUM ('pending_answer', 'answered_hidden', 'published', 'dismissed');

-- CreateTable
CREATE TABLE "ContractQuestion" (
    "id" SERIAL NOT NULL,
    "contractId" INTEGER NOT NULL,
    "askerId" INTEGER,
    "answeredById" INTEGER,
    "question" TEXT NOT NULL,
    "answer" TEXT,
    "contentFingerprint" TEXT NOT NULL,
    "status" "ContractQuestionStatus" NOT NULL DEFAULT 'pending_answer',
    "deliveryStatus" "DeliveryStatus" NOT NULL DEFAULT 'pending',
    "deliveryError" TEXT,
    "authorTelegramMessageId" BIGINT,
    "answeredAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractQuestionReplySession" (
    "authorId" INTEGER NOT NULL,
    "questionId" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractQuestionReplySession_pkey" PRIMARY KEY ("authorId")
);

-- CreateIndex
CREATE INDEX "ContractQuestion_contractId_status_publishedAt_idx" ON "ContractQuestion"("contractId", "status", "publishedAt");
CREATE INDEX "ContractQuestion_askerId_createdAt_idx" ON "ContractQuestion"("askerId", "createdAt");
CREATE INDEX "ContractQuestion_deliveryStatus_createdAt_idx" ON "ContractQuestion"("deliveryStatus", "createdAt");
CREATE INDEX "ContractQuestion_contractId_contentFingerprint_createdAt_idx" ON "ContractQuestion"("contractId", "contentFingerprint", "createdAt");
CREATE UNIQUE INDEX "ContractQuestionReplySession_questionId_key" ON "ContractQuestionReplySession"("questionId");
CREATE INDEX "ContractQuestionReplySession_expiresAt_idx" ON "ContractQuestionReplySession"("expiresAt");

-- AddForeignKey
ALTER TABLE "ContractQuestion" ADD CONSTRAINT "ContractQuestion_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContractQuestion" ADD CONSTRAINT "ContractQuestion_askerId_fkey" FOREIGN KEY ("askerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContractQuestion" ADD CONSTRAINT "ContractQuestion_answeredById_fkey" FOREIGN KEY ("answeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContractQuestionReplySession" ADD CONSTRAINT "ContractQuestionReplySession_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContractQuestionReplySession" ADD CONSTRAINT "ContractQuestionReplySession_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "ContractQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
