CREATE TABLE "ContractFavorite" (
    "userId" INTEGER NOT NULL,
    "contractId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractFavorite_pkey" PRIMARY KEY ("userId","contractId")
);

CREATE INDEX "ContractFavorite_contractId_createdAt_idx"
ON "ContractFavorite"("contractId", "createdAt");

ALTER TABLE "ContractFavorite"
ADD CONSTRAINT "ContractFavorite_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContractFavorite"
ADD CONSTRAINT "ContractFavorite_contractId_fkey"
FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
