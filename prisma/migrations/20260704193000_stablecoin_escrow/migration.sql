-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "EscrowCurrency" AS ENUM ('TON', 'USDT', 'USDC');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "escrowCurrency" "EscrowCurrency" NOT NULL DEFAULT 'TON';

-- AlterTable
ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "escrowCurrency" "EscrowCurrency" NOT NULL DEFAULT 'TON';
ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "escrowJettonMasterAddress" TEXT;
ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "escrowJettonWalletAddress" TEXT;
ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "escrowJettonAmount" DECIMAL(30,0);
