ALTER TABLE "PaymentIntent"
ADD COLUMN "reconciliationClaimedAt" TIMESTAMP(3),
ADD COLUMN "reconciliationNextAttemptAt" TIMESTAMP(3);

CREATE INDEX "PaymentIntent_status_reconciliationNextAttemptAt_idx"
ON "PaymentIntent"("status", "reconciliationNextAttemptAt");
