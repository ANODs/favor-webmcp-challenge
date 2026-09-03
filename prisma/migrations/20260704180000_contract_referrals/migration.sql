CREATE TYPE "ContractReferralStatus" AS ENUM ('active', 'paused', 'cancelled');

CREATE TYPE "ContractReferralSource" AS ENUM ('scout', 'user_referral');

CREATE TYPE "ContractReferralRewardStatus" AS ENUM ('accrued', 'cancelled');

CREATE TABLE "ContractReferral" (
    "id" SERIAL NOT NULL,
    "contractId" INTEGER NOT NULL,
    "referrerId" INTEGER NOT NULL,
    "authorId" INTEGER NOT NULL,
    "source" "ContractReferralSource" NOT NULL DEFAULT 'scout',
    "rewardPercent" DECIMAL(5,2) NOT NULL DEFAULT 20.00,
    "status" "ContractReferralStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractReferral_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContractReferralReward" (
    "id" SERIAL NOT NULL,
    "referralId" INTEGER NOT NULL,
    "contractId" INTEGER NOT NULL,
    "dealId" INTEGER NOT NULL,
    "referrerId" INTEGER NOT NULL,
    "dealAmount" DECIMAL(12,4) NOT NULL,
    "platformFeePercent" DECIMAL(5,2) NOT NULL DEFAULT 5.00,
    "rewardPercent" DECIMAL(5,2) NOT NULL,
    "platformFeeAmount" DECIMAL(12,4) NOT NULL,
    "rewardAmount" DECIMAL(12,4) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USDT',
    "status" "ContractReferralRewardStatus" NOT NULL DEFAULT 'accrued',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractReferralReward_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContractReferral_contractId_key" ON "ContractReferral"("contractId");
CREATE INDEX "ContractReferral_referrerId_status_idx" ON "ContractReferral"("referrerId", "status");
CREATE INDEX "ContractReferral_authorId_idx" ON "ContractReferral"("authorId");

CREATE UNIQUE INDEX "ContractReferralReward_dealId_key" ON "ContractReferralReward"("dealId");
CREATE INDEX "ContractReferralReward_referralId_idx" ON "ContractReferralReward"("referralId");
CREATE INDEX "ContractReferralReward_contractId_status_idx" ON "ContractReferralReward"("contractId", "status");
CREATE INDEX "ContractReferralReward_referrerId_status_idx" ON "ContractReferralReward"("referrerId", "status");

ALTER TABLE "ContractReferral"
ADD CONSTRAINT "ContractReferral_contractId_fkey"
FOREIGN KEY ("contractId") REFERENCES "Contract"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContractReferral"
ADD CONSTRAINT "ContractReferral_referrerId_fkey"
FOREIGN KEY ("referrerId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContractReferral"
ADD CONSTRAINT "ContractReferral_authorId_fkey"
FOREIGN KEY ("authorId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContractReferralReward"
ADD CONSTRAINT "ContractReferralReward_referralId_fkey"
FOREIGN KEY ("referralId") REFERENCES "ContractReferral"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContractReferralReward"
ADD CONSTRAINT "ContractReferralReward_contractId_fkey"
FOREIGN KEY ("contractId") REFERENCES "Contract"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContractReferralReward"
ADD CONSTRAINT "ContractReferralReward_dealId_fkey"
FOREIGN KEY ("dealId") REFERENCES "Deal"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContractReferralReward"
ADD CONSTRAINT "ContractReferralReward_referrerId_fkey"
FOREIGN KEY ("referrerId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "ContractReferral" ("contractId", "referrerId", "authorId", "source", "rewardPercent", "status", "createdAt", "updatedAt")
SELECT c."id", c."scoutId", c."authorId", 'scout', 20.00, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Contract" c
WHERE c."scoutId" IS NOT NULL
  AND c."scoutId" <> c."authorId";

INSERT INTO "ContractReferral" ("contractId", "referrerId", "authorId", "source", "rewardPercent", "status", "createdAt", "updatedAt")
SELECT c."id", u."referredById", c."authorId", 'user_referral', 20.00, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Contract" c
JOIN "User" u ON u."id" = c."authorId"
WHERE u."referredById" IS NOT NULL
  AND u."referredById" <> c."authorId"
  AND NOT EXISTS (
    SELECT 1 FROM "ContractReferral" cr WHERE cr."contractId" = c."id"
  );
