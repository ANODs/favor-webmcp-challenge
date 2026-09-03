-- AlterEnum
ALTER TYPE "ContractStatus" ADD VALUE IF NOT EXISTS 'unclaimed';
ALTER TYPE "ContractStatus" ADD VALUE IF NOT EXISTS 'pending_verification';
