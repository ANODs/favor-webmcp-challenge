-- CreateEnum
CREATE TYPE "Role" AS ENUM ('customer', 'freelancer', 'moderator');

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('telegram', 'email', 'google', 'apple');

-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('offer', 'order');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('pending_moderation', 'active', 'limit_reached', 'rejected', 'archived');

-- CreateEnum
CREATE TYPE "DealStatus" AS ENUM ('pending_approval', 'rejected', 'in_progress', 'work_completed_by_freelancer', 'paid_by_customer', 'payment_received_by_freelancer', 'result_sent_by_freelancer', 'result_received_by_customer', 'revision_requested', 'awaiting_review', 'cancellation_requested', 'cancelled', 'completed');

-- CreateEnum
CREATE TYPE "BotStatus" AS ENUM ('pending', 'active', 'paused', 'failed');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('app_to_bot', 'bot_to_app', 'telegram_in', 'telegram_out');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('pending', 'sent', 'delivered', 'failed');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT,
    "password" TEXT,
    "role" "Role" NOT NULL DEFAULT 'customer',
    "primaryAuthProvider" "AuthProvider" NOT NULL DEFAULT 'telegram',
    "telegramId" BIGINT NOT NULL,
    "telegramUsername" TEXT,
    "telegramFirstName" TEXT,
    "telegramLastName" TEXT,
    "telegramPhotoUrl" TEXT,
    "telegramIsVerified" BOOLEAN NOT NULL DEFAULT true,
    "name" TEXT,
    "rating" INTEGER NOT NULL DEFAULT 0,
    "walletAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" SERIAL NOT NULL,
    "authorId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "ContractType" NOT NULL,
    "category" TEXT,
    "tags" TEXT[],
    "basePrice" DECIMAL(10,2),
    "deadlineDays" INTEGER,
    "maxOpenDeals" INTEGER NOT NULL DEFAULT 1,
    "status" "ContractStatus" NOT NULL DEFAULT 'pending_moderation',
    "moderationComment" TEXT,
    "telegramPostUrl" TEXT,
    "telegramChannelUrl" TEXT,
    "cachedTelegramText" TEXT,
    "mediaRefs" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deal" (
    "id" SERIAL NOT NULL,
    "contractId" INTEGER NOT NULL,
    "customerId" INTEGER NOT NULL,
    "freelancerId" INTEGER NOT NULL,
    "details" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "deadlineDays" INTEGER,
    "status" "DealStatus" NOT NULL DEFAULT 'pending_approval',
    "paidByCustomer" BOOLEAN NOT NULL DEFAULT false,
    "paymentReceivedByFreelancer" BOOLEAN NOT NULL DEFAULT false,
    "resultSentByFreelancer" BOOLEAN NOT NULL DEFAULT false,
    "resultReceivedByCustomer" BOOLEAN NOT NULL DEFAULT false,
    "reviewLeftByCustomer" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Communication" (
    "id" SERIAL NOT NULL,
    "dealId" INTEGER NOT NULL,
    "customerId" INTEGER NOT NULL,
    "freelancerId" INTEGER NOT NULL,
    "telegramChatId" BIGINT,
    "telegramChatType" TEXT,
    "telegramThreadId" BIGINT,
    "botStatus" "BotStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Communication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" SERIAL NOT NULL,
    "communicationId" INTEGER NOT NULL,
    "senderId" INTEGER NOT NULL,
    "telegramMessageId" BIGINT,
    "direction" "MessageDirection" NOT NULL,
    "deliveryStatus" "DeliveryStatus" NOT NULL DEFAULT 'pending',
    "content" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" SERIAL NOT NULL,
    "dealId" INTEGER NOT NULL,
    "reviewerId" INTEGER NOT NULL,
    "reviewedUserId" INTEGER NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_telegramId_key" ON "User"("telegramId");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_slug_key" ON "Contract"("slug");

-- CreateIndex
CREATE INDEX "Contract_status_type_idx" ON "Contract"("status", "type");

-- CreateIndex
CREATE INDEX "Contract_authorId_status_idx" ON "Contract"("authorId", "status");

-- CreateIndex
CREATE INDEX "Deal_contractId_status_idx" ON "Deal"("contractId", "status");

-- CreateIndex
CREATE INDEX "Deal_customerId_status_idx" ON "Deal"("customerId", "status");

-- CreateIndex
CREATE INDEX "Deal_freelancerId_status_idx" ON "Deal"("freelancerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Communication_dealId_key" ON "Communication"("dealId");

-- CreateIndex
CREATE INDEX "Message_communicationId_sentAt_idx" ON "Message"("communicationId", "sentAt");

-- CreateIndex
CREATE INDEX "Review_reviewedUserId_createdAt_idx" ON "Review"("reviewedUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Review_dealId_reviewerId_key" ON "Review"("dealId", "reviewerId");

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_freelancerId_fkey" FOREIGN KEY ("freelancerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Communication" ADD CONSTRAINT "Communication_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Communication" ADD CONSTRAINT "Communication_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Communication" ADD CONSTRAINT "Communication_freelancerId_fkey" FOREIGN KEY ("freelancerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_communicationId_fkey" FOREIGN KEY ("communicationId") REFERENCES "Communication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_reviewedUserId_fkey" FOREIGN KEY ("reviewedUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
