-- AlterTable
ALTER TABLE "Contract" ADD COLUMN "scoutId" INTEGER;
ALTER TABLE "Contract" ADD COLUMN "verificationCode" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "adBalance" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "premiumExpiresAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ContractReveal" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "contractId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractReveal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContractReveal_userId_createdAt_idx" ON "ContractReveal"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContractReveal_userId_contractId_key" ON "ContractReveal"("userId", "contractId");

-- AddForeignKey
ALTER TABLE "ContractReveal" ADD CONSTRAINT "ContractReveal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractReveal" ADD CONSTRAINT "ContractReveal_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_scoutId_fkey" FOREIGN KEY ("scoutId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
