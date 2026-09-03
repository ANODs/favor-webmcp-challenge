-- CreateTable
CREATE TABLE "ContractView" (
    "id" SERIAL NOT NULL,
    "contractId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContractView_contractId_createdAt_idx" ON "ContractView"("contractId", "createdAt");

-- CreateIndex
CREATE INDEX "ContractView_userId_createdAt_idx" ON "ContractView"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContractView_contractId_userId_key" ON "ContractView"("contractId", "userId");

-- AddForeignKey
ALTER TABLE "ContractView" ADD CONSTRAINT "ContractView_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractView" ADD CONSTRAINT "ContractView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
