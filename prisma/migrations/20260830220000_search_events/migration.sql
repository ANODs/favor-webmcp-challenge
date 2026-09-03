CREATE TYPE "SearchScope" AS ENUM ('contracts', 'deals');
CREATE TYPE "SearchEventTrigger" AS ENUM ('search_commit', 'filter_change', 'reset');

CREATE TABLE "SearchEvent" (
    "eventId" UUID NOT NULL,
    "userId" INTEGER NOT NULL,
    "scope" "SearchScope" NOT NULL,
    "query" VARCHAR(200) NOT NULL,
    "queryKey" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "trigger" "SearchEventTrigger" NOT NULL,
    "locale" VARCHAR(2),
    "clientSearchedAt" TIMESTAMP(3) NOT NULL,
    "effectiveClientSearchedAt" TIMESTAMP(3) NOT NULL,
    "historyDeletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchEvent_pkey" PRIMARY KEY ("eventId")
);

CREATE INDEX "SearchEvent_history_lookup_idx"
ON "SearchEvent"("userId", "scope", "trigger", "historyDeletedAt", "queryKey", "createdAt" DESC);

CREATE INDEX "SearchEvent_scope_createdAt_idx"
ON "SearchEvent"("scope", "createdAt");

CREATE TABLE "SearchHistoryDeletion" (
    "operationId" UUID NOT NULL,
    "userId" INTEGER NOT NULL,
    "scope" "SearchScope" NOT NULL,
    "queryKey" TEXT NOT NULL,
    "clientDeletedAt" TIMESTAMP(3) NOT NULL,
    "effectiveClientDeletedAt" TIMESTAMP(3) NOT NULL,
    "serverDeletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchHistoryDeletion_pkey" PRIMARY KEY ("operationId")
);

CREATE INDEX "SearchHistoryDeletion_cutoff_lookup_idx"
ON "SearchHistoryDeletion"("userId", "scope", "queryKey", "effectiveClientDeletedAt" DESC);

CREATE INDEX "SearchHistoryDeletion_scope_serverDeletedAt_idx"
ON "SearchHistoryDeletion"("scope", "serverDeletedAt");

ALTER TABLE "SearchEvent" ADD CONSTRAINT "SearchEvent_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SearchHistoryDeletion" ADD CONSTRAINT "SearchHistoryDeletion_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
