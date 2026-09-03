ALTER TABLE "PaymentIntent"
ADD COLUMN "beneficiaryUserId" INTEGER,
ADD COLUMN "idempotencyKey" TEXT,
ADD COLUMN "providerSubmissionId" TEXT;

UPDATE "PaymentIntent"
SET "beneficiaryUserId" = "userId"
WHERE "product" = 'subscription';

ALTER TABLE "PaymentIntent"
ADD CONSTRAINT "PaymentIntent_subscription_beneficiary_check"
CHECK (
  ("product" = 'subscription' AND "beneficiaryUserId" IS NOT NULL)
  OR ("product" <> 'subscription' AND "beneficiaryUserId" IS NULL)
);

CREATE UNIQUE INDEX "PaymentIntent_userId_idempotencyKey_key"
ON "PaymentIntent"("userId", "idempotencyKey");

CREATE UNIQUE INDEX "PaymentIntent_providerSubmissionId_key"
ON "PaymentIntent"("providerSubmissionId");

CREATE INDEX "PaymentIntent_beneficiaryUserId_product_status_idx"
ON "PaymentIntent"("beneficiaryUserId", "product", "status");

ALTER TABLE "PaymentIntent"
ADD CONSTRAINT "PaymentIntent_beneficiaryUserId_fkey"
FOREIGN KEY ("beneficiaryUserId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
