-- AlterTable: Add escrow fields to Deal
ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "isEscrow" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "escrowAddress" TEXT;
ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "escrowState" TEXT;
ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "escrowLockedAmountTon" DECIMAL(20,9);
ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "escrowTonUsdtRate" DECIMAL(10,4);
ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "escrowTxHash" TEXT;

-- AlterTable: Add isEscrow to Contract (existing legacy rows initialized to false)
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "isEscrow" BOOLEAN NOT NULL DEFAULT false;

-- Alter default of isEscrow in Contract to true for future insertions
ALTER TABLE "Contract" ALTER COLUMN "isEscrow" SET DEFAULT true;
