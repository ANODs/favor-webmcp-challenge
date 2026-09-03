CREATE TYPE "ContractPublicationDraftStatus" AS ENUM ('prepared', 'claimed', 'publishing', 'published');

CREATE TABLE "ContractPublicationDraft" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "status" "ContractPublicationDraftStatus" NOT NULL DEFAULT 'prepared',
    "ownerUserId" INTEGER,
    "claimedByUserId" INTEGER,
    "contractId" INTEGER,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "claimedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractPublicationDraft_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContractPublicationDraft_tokenHash_key" ON "ContractPublicationDraft"("tokenHash");
CREATE UNIQUE INDEX "ContractPublicationDraft_contractId_key" ON "ContractPublicationDraft"("contractId");
CREATE INDEX "ContractPublicationDraft_expiresAt_idx" ON "ContractPublicationDraft"("expiresAt");
CREATE INDEX "ContractPublicationDraft_claimedByUserId_status_idx" ON "ContractPublicationDraft"("claimedByUserId", "status");

ALTER TABLE "ContractPublicationDraft"
ADD CONSTRAINT "ContractPublicationDraft_ownerUserId_fkey"
FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ContractPublicationDraft"
ADD CONSTRAINT "ContractPublicationDraft_claimedByUserId_fkey"
FOREIGN KEY ("claimedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ContractPublicationDraft"
ADD CONSTRAINT "ContractPublicationDraft_contractId_fkey"
FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;
