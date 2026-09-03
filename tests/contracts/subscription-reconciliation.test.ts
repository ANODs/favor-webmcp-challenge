import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const readSource = (filePath: string) =>
  readFileSync(path.resolve(filePath), "utf8");

test("premium cron always runs a bounded autonomous subscription sweep", () => {
  const cronSource = readSource(
    "src/app/api/cron/revalidate-expired-premium/route.ts",
  );
  const reconciliationSource = readSource(
    "src/features/favor-subscription/server/reconciliation.ts",
  );
  const serverApiSource = readSource(
    "src/features/favor-subscription/server.ts",
  );
  const startupSource = readSource("scripts/start-production.sh");
  const dockerSource = readSource("Dockerfile");

  const sweepCall = cronSource.indexOf(
    "reconcileDueOnchainSubscriptionPayments()",
  );
  const noExpiredUsersBranch = cronSource.indexOf(
    "if (expiredUsers.length === 0)",
  );
  assert.ok(sweepCall >= 0);
  assert.ok(noExpiredUsersBranch > sweepCall);
  assert.match(cronSource, /subscriptionReconciliation/);
  assert.match(
    reconciliationSource,
    /DEFAULT_RECONCILIATION_SWEEP_LIMIT\s*=\s*5/,
  );
  assert.match(
    reconciliationSource,
    /Math\.min\(Math\.trunc\(limit\), MAX_RECONCILIATION_SWEEP_LIMIT\)/,
  );
  assert.match(reconciliationSource, /take:\s*boundedLimit/);
  assert.match(serverApiSource, /reconcileDueOnchainSubscriptionPayments/);
  assert.match(
    startupSource,
    /SUBSCRIPTION_RECONCILE_INTERVAL_SECONDS="\$\{SUBSCRIPTION_RECONCILE_INTERVAL_SECONDS:-60\}"/,
  );
  assert.match(
    startupSource,
    /sleep "\$SUBSCRIPTION_RECONCILE_INTERVAL_SECONDS"[\s\S]*\.\/node_modules\/\.bin\/tsx scripts\/cron\/remove-expired-premium\.ts/,
  );
  assert.match(dockerSource, /COPY --from=builder \/app\/scripts \.\/scripts/);
  assert.match(dockerSource, /CMD \["sh", "\.\/scripts\/start-production\.sh"\]/);
});

test("on-chain reconciliation uses a durable per-intent lease and backoff", () => {
  const schemaSource = readSource("prisma/schema.prisma");
  const migrationSource = readSource(
    "prisma/migrations/20260827213000_payment_intent_reconciliation_lease/migration.sql",
  );
  const reconciliationSource = readSource(
    "src/features/favor-subscription/server/reconciliation.ts",
  );

  assert.match(schemaSource, /reconciliationClaimedAt\s+DateTime\?/);
  assert.match(schemaSource, /reconciliationNextAttemptAt\s+DateTime\?/);
  assert.match(migrationSource, /ADD COLUMN "reconciliationClaimedAt"/);
  assert.match(migrationSource, /ADD COLUMN "reconciliationNextAttemptAt"/);
  assert.match(
    reconciliationSource,
    /RECONCILIATION_BACKOFF_MS\s*=\s*60\s*\*\s*1000/,
  );
  assert.match(
    reconciliationSource,
    /reconciliationClaimedAt:\s*serverTime[\s\S]*reconciliationNextAttemptAt:\s*nextAttemptAt/,
  );
  assert.match(
    reconciliationSource,
    /if \(!leaseClaimed\)[\s\S]*resolveAuthoritativeIntentResult/,
  );
});

test("search budget exhaustion remains pending and cannot expire an intent", () => {
  const tonSource = readSource("src/shared/lib/ton/server.ts");
  const reconciliationSource = readSource(
    "src/features/favor-subscription/server/reconciliation.ts",
  );

  assert.match(tonSource, /return \{ status: "budget_exhausted" \};/);
  const budgetBranch = reconciliationSource.indexOf(
    'if (lookup.status === "budget_exhausted")',
  );
  const reconciliationExpiry = reconciliationSource.indexOf(
    'failureReason: "PAYMENT_RECONCILIATION_EXPIRED"',
  );
  assert.ok(budgetBranch >= 0);
  assert.ok(reconciliationExpiry > budgetBranch);
  assert.match(
    reconciliationSource.slice(budgetBranch, reconciliationExpiry),
    /return resolveAuthoritativeIntentResult/,
  );
});

test("FAVOR verification searches the frozen intent Jetton wallets", () => {
  const tonSource = readSource("src/shared/lib/ton/server.ts");
  const favorPaymentSource = readSource(
    "src/shared/lib/favor-payment/server.ts",
  );
  const reconciliationSource = readSource(
    "src/features/favor-subscription/server/reconciliation.ts",
  );
  const finderStart = tonSource.indexOf(
    "export const findFavorSubscriptionTransactionByReference",
  );
  const verifierStart = tonSource.indexOf(
    "export const verifyFavorJettonSubscriptionTransaction",
  );
  const finderSource = tonSource.slice(finderStart, verifierStart);

  assert.match(finderSource, /senderJettonWalletAddress:\s*string/);
  assert.match(finderSource, /recipientJettonWalletAddress:\s*string/);
  assert.match(finderSource, /address:\s*recipientJettonWallet/);
  assert.doesNotMatch(finderSource, /runMethod|get_wallet_address/);
  assert.match(
    reconciliationSource,
    /recipientJettonWalletAddress:\s*intent\.recipientJettonWalletAddress/,
  );
  assert.match(
    favorPaymentSource,
    /recipientJettonWalletAddress:\s*intent\.recipientJettonWalletAddress/,
  );
});

test("expiration and fulfillment resolve one authoritative terminal state", () => {
  const reconciliationSource = readSource(
    "src/features/favor-subscription/server/reconciliation.ts",
  );
  const fulfillmentSource = readSource(
    "src/features/favor-subscription/server/fulfillment.ts",
  );
  const confirmationSource = readSource(
    "src/features/favor-subscription/server/confirmation.ts",
  );
  const favorPaymentSource = readSource(
    "src/shared/lib/favor-payment/server.ts",
  );
  const expireHelperStart = reconciliationSource.indexOf(
    "const expireIntentAndResolve",
  );
  const leaseHelperStart = reconciliationSource.indexOf(
    "const claimReconciliationLease",
  );
  const expireHelperSource = reconciliationSource.slice(
    expireHelperStart,
    leaseHelperStart,
  );

  assert.match(expireHelperSource, /paymentIntent\.updateMany/);
  assert.match(expireHelperSource, /return resolveAuthoritativeIntentResult/);
  const terminalGuard = fulfillmentSource.indexOf(
    "intent.status === PaymentIntentStatus.failed",
  );
  const purchaseWrite = fulfillmentSource.indexOf(
    "subscriptionPurchase.create",
  );
  assert.ok(terminalGuard >= 0);
  assert.ok(purchaseWrite > terminalGuard);
  assert.match(
    fulfillmentSource,
    /intent\.status === PaymentIntentStatus\.failed[\s\S]*SUBSCRIPTION_PAYMENT_FAILED/,
  );
  assert.match(
    fulfillmentSource,
    /if \(!verification\)[\s\S]*intent\.status === PaymentIntentStatus\.expired[\s\S]*PAYMENT_WINDOW_EXPIRED/,
  );
  assert.match(
    fulfillmentSource,
    /paidAt > intent\.expiresAt[\s\S]*indexer may reveal a timely on-chain payment/,
  );
  assert.match(
    confirmationSource,
    /claimExpiredTonSubmission[\s\S]*verifyTonSubscriptionTransaction/,
  );
  assert.match(
    favorPaymentSource,
    /claimExpiredFavorSubmission[\s\S]*verifyFavorJettonSubscriptionTransaction/,
  );
});
