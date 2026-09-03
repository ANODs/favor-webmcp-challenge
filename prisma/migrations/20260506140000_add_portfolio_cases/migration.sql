-- CreateTable
CREATE TABLE "PortfolioCase" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "telegramPostUrl" TEXT,
    "links" JSONB,
    "contractId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortfolioCase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PortfolioCase_userId_createdAt_idx" ON "PortfolioCase"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "PortfolioCase" ADD CONSTRAINT "PortfolioCase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioCase" ADD CONSTRAINT "PortfolioCase_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;
