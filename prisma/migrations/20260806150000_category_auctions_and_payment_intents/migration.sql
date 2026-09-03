CREATE TYPE "PaymentProvider" AS ENUM ('ton_chain', 'telegram_stars');
CREATE TYPE "PaymentAsset" AS ENUM ('FAVOR', 'GRAM', 'XTR');
CREATE TYPE "PaymentProduct" AS ENUM ('subscription', 'category_auction_bid');
CREATE TYPE "PaymentIntentStatus" AS ENUM ('created', 'submitted', 'confirmed', 'failed', 'expired');
CREATE TYPE "CategoryAuctionStatus" AS ENUM ('open', 'awaiting_payment', 'settled', 'cancelled');
CREATE TYPE "CategoryAuctionBidStatus" AS ENUM ('active', 'awaiting_payment', 'payment_failed', 'winner');
CREATE TYPE "CategoryPromotionSource" AS ENUM ('paid_auction', 'premium_free');

CREATE TABLE "PaymentIntent" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "asset" "PaymentAsset" NOT NULL,
    "product" "PaymentProduct" NOT NULL,
    "status" "PaymentIntentStatus" NOT NULL DEFAULT 'created',
    "amountNano" DECIMAL(30,0) NOT NULL,
    "quotedPriceUsdt" DECIMAL(18,8),
    "senderAddress" TEXT,
    "senderJettonWalletAddress" TEXT,
    "recipientAddress" TEXT,
    "recipientJettonWalletAddress" TEXT,
    "reference" TEXT NOT NULL,
    "boc" TEXT,
    "submittedAt" TIMESTAMP(3),
    "txHash" TEXT,
    "txTimestamp" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PaymentIntent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SubscriptionPurchase" (
    "id" SERIAL NOT NULL,
    "paymentIntentId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "duration" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SubscriptionPurchase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CategoryAuction" (
    "id" SERIAL NOT NULL,
    "categoryKey" TEXT NOT NULL,
    "categoryName" TEXT NOT NULL,
    "starterId" INTEGER NOT NULL,
    "premiumFreeStart" BOOLEAN NOT NULL DEFAULT false,
    "status" "CategoryAuctionStatus" NOT NULL DEFAULT 'open',
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "biddingEndsAt" TIMESTAMP(3) NOT NULL,
    "currentCandidateBidId" INTEGER,
    "paymentDeadlineAt" TIMESTAMP(3),
    "winnerUserId" INTEGER,
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CategoryAuction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CategoryAuctionBid" (
    "id" SERIAL NOT NULL,
    "auctionId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "contractId" INTEGER,
    "amountNano" DECIMAL(30,0) NOT NULL,
    "status" "CategoryAuctionBidStatus" NOT NULL DEFAULT 'active',
    "placedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CategoryAuctionBid_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CategoryAuctionBidEvent" (
    "id" SERIAL NOT NULL,
    "bidId" INTEGER NOT NULL,
    "amountNano" DECIMAL(30,0) NOT NULL,
    "previousAmountNano" DECIMAL(30,0),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CategoryAuctionBidEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuctionPaymentAttempt" (
    "id" SERIAL NOT NULL,
    "bidId" INTEGER NOT NULL,
    "paymentIntentId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuctionPaymentAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CategoryPromotion" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "categoryKey" TEXT NOT NULL,
    "categoryName" TEXT NOT NULL,
    "auctionId" INTEGER NOT NULL,
    "assignedContractId" INTEGER,
    "source" "CategoryPromotionSource" NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CategoryPromotion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentIntent_reference_key" ON "PaymentIntent"("reference");
CREATE UNIQUE INDEX "PaymentIntent_txHash_key" ON "PaymentIntent"("txHash");
CREATE INDEX "PaymentIntent_userId_product_status_idx" ON "PaymentIntent"("userId", "product", "status");
CREATE INDEX "PaymentIntent_status_expiresAt_idx" ON "PaymentIntent"("status", "expiresAt");
CREATE UNIQUE INDEX "SubscriptionPurchase_paymentIntentId_key" ON "SubscriptionPurchase"("paymentIntentId");
CREATE INDEX "SubscriptionPurchase_userId_endsAt_idx" ON "SubscriptionPurchase"("userId", "endsAt");
CREATE INDEX "CategoryAuction_categoryKey_status_biddingEndsAt_idx" ON "CategoryAuction"("categoryKey", "status", "biddingEndsAt");
CREATE UNIQUE INDEX "CategoryAuction_one_live_category_key" ON "CategoryAuction"("categoryKey") WHERE "status" IN ('open', 'awaiting_payment');
CREATE INDEX "CategoryAuction_starterId_status_idx" ON "CategoryAuction"("starterId", "status");
CREATE INDEX "CategoryAuction_currentCandidateBidId_idx" ON "CategoryAuction"("currentCandidateBidId");
CREATE UNIQUE INDEX "CategoryAuctionBid_auctionId_userId_key" ON "CategoryAuctionBid"("auctionId", "userId");
CREATE INDEX "CategoryAuctionBid_auctionId_amountNano_placedAt_idx" ON "CategoryAuctionBid"("auctionId", "amountNano", "placedAt");
CREATE INDEX "CategoryAuctionBid_userId_status_idx" ON "CategoryAuctionBid"("userId", "status");
CREATE INDEX "CategoryAuctionBidEvent_bidId_createdAt_idx" ON "CategoryAuctionBidEvent"("bidId", "createdAt");
CREATE UNIQUE INDEX "AuctionPaymentAttempt_paymentIntentId_key" ON "AuctionPaymentAttempt"("paymentIntentId");
CREATE UNIQUE INDEX "AuctionPaymentAttempt_bidId_attemptNumber_key" ON "AuctionPaymentAttempt"("bidId", "attemptNumber");
CREATE UNIQUE INDEX "CategoryPromotion_auctionId_key" ON "CategoryPromotion"("auctionId");
CREATE INDEX "CategoryPromotion_categoryKey_startsAt_endsAt_idx" ON "CategoryPromotion"("categoryKey", "startsAt", "endsAt");
CREATE INDEX "CategoryPromotion_userId_endsAt_idx" ON "CategoryPromotion"("userId", "endsAt");
CREATE INDEX "CategoryPromotion_assignedContractId_endsAt_idx" ON "CategoryPromotion"("assignedContractId", "endsAt");

ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubscriptionPurchase" ADD CONSTRAINT "SubscriptionPurchase_paymentIntentId_fkey" FOREIGN KEY ("paymentIntentId") REFERENCES "PaymentIntent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionPurchase" ADD CONSTRAINT "SubscriptionPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CategoryAuction" ADD CONSTRAINT "CategoryAuction_starterId_fkey" FOREIGN KEY ("starterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CategoryAuctionBid" ADD CONSTRAINT "CategoryAuctionBid_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "CategoryAuction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CategoryAuctionBid" ADD CONSTRAINT "CategoryAuctionBid_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CategoryAuctionBid" ADD CONSTRAINT "CategoryAuctionBid_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CategoryAuctionBidEvent" ADD CONSTRAINT "CategoryAuctionBidEvent_bidId_fkey" FOREIGN KEY ("bidId") REFERENCES "CategoryAuctionBid"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuctionPaymentAttempt" ADD CONSTRAINT "AuctionPaymentAttempt_bidId_fkey" FOREIGN KEY ("bidId") REFERENCES "CategoryAuctionBid"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuctionPaymentAttempt" ADD CONSTRAINT "AuctionPaymentAttempt_paymentIntentId_fkey" FOREIGN KEY ("paymentIntentId") REFERENCES "PaymentIntent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CategoryPromotion" ADD CONSTRAINT "CategoryPromotion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CategoryPromotion" ADD CONSTRAINT "CategoryPromotion_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "CategoryAuction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CategoryPromotion" ADD CONSTRAINT "CategoryPromotion_assignedContractId_fkey" FOREIGN KEY ("assignedContractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;
