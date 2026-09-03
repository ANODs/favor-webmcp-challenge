import assert from "node:assert/strict";
import test from "node:test";

import {
  getPremiumSubscriptionMessages,
  getPremiumSubscriptionMonthlyPrice,
  getPremiumSubscriptionYearlyPrice,
} from "../../src/shared/lib/telegram/payments";

test("Telegram subscription invoice copy follows the requested locale", () => {
  const english = getPremiumSubscriptionMessages("en");
  const russian = getPremiumSubscriptionMessages("ru");

  assert.equal(getPremiumSubscriptionMonthlyPrice("en").label, "Favor Plus (1 month)");
  assert.equal(
    getPremiumSubscriptionYearlyPrice("en").label,
    "Favor Plus (1 year, 50% off)",
  );
  assert.match(english.monthlyDescription, /premium access/i);
  assert.doesNotMatch(english.monthlyDescription, /[\u0400-\u04ff]/u);
  assert.match(russian.monthlyDescription, /Премиум-доступ/u);
});
