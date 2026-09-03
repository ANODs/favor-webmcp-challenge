-- Deal-scoped project materials captured when the parties agree to start work.
ALTER TABLE "Deal"
ADD COLUMN "briefResources" JSONB,
ADD COLUMN "escrowVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "escrowCustomerWalletAddress" TEXT,
ADD COLUMN "escrowFundingCheckedAt" TIMESTAMP(3),
ADD COLUMN "paymentReminderNotifiedAt" TIMESTAMP(3),
ADD COLUMN "paymentReminderAttemptedAt" TIMESTAMP(3),
ADD COLUMN "deadlineReminderNotifiedAt" TIMESTAMP(3),
ADD COLUMN "deadlineReminderAttemptedAt" TIMESTAMP(3),
ADD COLUMN "deadlineExpiredAt" TIMESTAMP(3),
ADD COLUMN "deadlineCustomerNotifiedAt" TIMESTAMP(3),
ADD COLUMN "deadlineFreelancerNotifiedAt" TIMESTAMP(3),
ADD COLUMN "deadlineOverdueAttemptedAt" TIMESTAMP(3);

-- Older in-progress deals did not always receive execution timestamps when
-- their escrow deposit was verified. updatedAt is the safest available
-- fallback for those legacy rows; new deposits use the confirmed funding time.
UPDATE "Deal"
SET
  "plannedStartedAt" = COALESCE("plannedStartedAt", "updatedAt"),
  "plannedDeadlineAt" = COALESCE(
    "plannedDeadlineAt",
    COALESCE("plannedStartedAt", "updatedAt") + make_interval(days => "deadlineDays")
  )
WHERE
  "status" = 'in_progress'
  AND "deadlineDays" IS NOT NULL
  AND "plannedDeadlineAt" IS NULL;

CREATE INDEX "Deal_status_plannedDeadlineAt_idx"
ON "Deal"("status", "plannedDeadlineAt");

CREATE INDEX "Deal_status_escrowFundingCheckedAt_idx"
ON "Deal"("status", "escrowFundingCheckedAt");
