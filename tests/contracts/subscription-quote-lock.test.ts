import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  MONTHLY_SUBSCRIPTION_DURATION,
  SUBSCRIPTION_QUOTE_CHANGED_CODE,
} from "../../src/entities/subscription";
import {
  assertExpectedSubscriptionQuote,
  buildFavorSubscriptionQuote,
  buildGramSubscriptionQuote,
} from "../../src/features/favor-subscription/server/quote";

test("on-chain subscription quotes quantize display and wallet amounts together", () => {
  const gram = buildGramSubscriptionQuote({
    duration: MONTHLY_SUBSCRIPTION_DURATION,
    gramPriceUsdt: 2,
  });
  const favor = buildFavorSubscriptionQuote({
    favorPriceInGram: 0.001,
    gramPriceUsdt: 2,
  });

  assert.equal(gram.amountNano % 1_000_000n, 0n);
  assert.equal(
    gram.amount,
    `${gram.amountNano / 1_000_000_000n}.${String(
      (gram.amountNano % 1_000_000_000n) / 1_000_000n,
    ).padStart(3, "0")}`,
  );
  assert.equal(favor.amountNano % 1_000_000_000n, 0n);
  assert.equal(favor.amount, String(favor.amountNano / 1_000_000_000n));
});

test("a stale or client-modified subscription quote fails closed", () => {
  const quote = buildGramSubscriptionQuote({
    duration: MONTHLY_SUBSCRIPTION_DURATION,
    gramPriceUsdt: 2,
  });

  assert.doesNotThrow(() =>
    assertExpectedSubscriptionQuote({
      asset: "GRAM",
      expectedAmountNano: quote.amountNano.toString(),
      actualAmountNano: quote.amountNano,
    }),
  );
  assert.throws(
    () =>
      assertExpectedSubscriptionQuote({
        asset: "GRAM",
        expectedAmountNano: (quote.amountNano - 1n).toString(),
        actualAmountNano: quote.amountNano,
      }),
    (error: unknown) =>
      Boolean(
        error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === SUBSCRIPTION_QUOTE_CHANGED_CODE,
      ),
  );
});

test("offer, prepare, click and wallet share the exact quote contract", () => {
  const dtoSource = readFileSync(
    path.resolve("src/entities/subscription/api/dto.ts"),
    "utf8",
  );
  const contractsSource = readFileSync(
    path.resolve("src/features/favor-subscription/server/contracts.ts"),
    "utf8",
  );
  const checkoutSource = readFileSync(
    path.resolve("src/features/favor-subscription/server/checkout.ts"),
    "utf8",
  );
  const hookSource = readFileSync(
    path.resolve(
      "src/features/favor-subscription/model/use-favor-subscription-checkout.ts",
    ),
    "utf8",
  );
  const dialogSource = readFileSync(
    path.resolve(
      "src/features/favor-subscription/ui/favor-subscription-dialog.tsx",
    ),
    "utf8",
  );
  const confirmationSource = readFileSync(
    path.resolve("src/features/favor-subscription/server/confirmation.ts"),
    "utf8",
  );
  const reconciliationSource = readFileSync(
    path.resolve("src/features/favor-subscription/server/reconciliation.ts"),
    "utf8",
  );

  assert.match(dtoSource, /gram:\s*\{\s*amount:\s*string;\s*amountNano:\s*string/);
  assert.match(dtoSource, /favor:\s*\{\s*amount:\s*string;\s*amountNano:\s*string/);
  assert.match(contractsSource, /expectedAmountNanoSchema = z\.string\(\)\.regex\(\/\^\[1-9\]\\d\{0,29\}\$\//);
  assert.equal(
    contractsSource.match(/expectedAmountNano:\s*expectedAmountNanoSchema/g)
      ?.length,
    2,
  );
  assert.match(checkoutSource, /expectedAmountNano\?:\s*string/);
  assert.match(
    checkoutSource,
    /intent\.amountNano\.toFixed\(0\)\s*!==\s*expected\.expectedAmountNano/,
  );
  assert.equal(
    checkoutSource.match(/assertExpectedSubscriptionQuote\(\{/g)?.length,
    2,
  );
  assert.match(
    hookSource,
    /prepared\.amountNano\s*!==\s*expectedAmountNano/,
  );
  assert.match(hookSource, /const refreshedOffer = await refetchOffer\(\)/);
  assert.match(
    dialogSource,
    /onTonPay\(selectedPlan\.gram\.amountNano\)/,
  );
  assert.match(
    dialogSource,
    /onFavorPay\(selectedPlan\.favor!\.amountNano\)/,
  );
  assert.match(
    confirmationSource,
    /expectedAmountNano:\s*BigInt\(intent\.amountNano\.toFixed\(0\)\)/,
  );
  assert.match(
    reconciliationSource,
    /expectedAmountNano:\s*BigInt\(intent\.amountNano\.toFixed\(0\)\)/,
  );
});
