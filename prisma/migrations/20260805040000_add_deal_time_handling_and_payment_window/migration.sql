-- AlterTable
ALTER TABLE "Contract" ADD COLUMN "paymentWindowHours" INTEGER DEFAULT 24;

-- AlterTable
ALTER TABLE "Deal" ADD COLUMN "paymentWindowHours" INTEGER DEFAULT 24,
ADD COLUMN "paymentExpiresAt" TIMESTAMP(3),
ADD COLUMN "plannedStartedAt" TIMESTAMP(3),
ADD COLUMN "plannedDeadlineAt" TIMESTAMP(3),
ADD COLUMN "completedAt" TIMESTAMP(3),
ADD COLUMN "actualDurationMinutes" INTEGER;
