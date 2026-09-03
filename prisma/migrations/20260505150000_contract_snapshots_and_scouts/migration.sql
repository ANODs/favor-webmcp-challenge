-- DropForeignKey
ALTER TABLE "Deal" DROP CONSTRAINT "Deal_contractId_fkey";

-- AlterTable
ALTER TABLE "Contract" ADD COLUMN "scoutedTelegramUsername" TEXT;

-- AlterTable
ALTER TABLE "Deal" ALTER COLUMN "contractId" DROP NOT NULL;
ALTER TABLE "Deal" ADD COLUMN "contractSnapshot" JSONB;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;
