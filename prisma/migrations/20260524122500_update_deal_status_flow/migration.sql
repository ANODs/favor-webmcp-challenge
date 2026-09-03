-- AlterEnum
ALTER TYPE "DealStatus" ADD VALUE 'in_dispute';

-- AlterTable
ALTER TABLE "Review" ADD COLUMN "isVerified" BOOLEAN NOT NULL DEFAULT false;
