import assert from "node:assert/strict";
import test from "node:test";

import englishMessages from "../../src/shared/locales/en.json";
import russianMessages from "../../src/shared/locales/ru.json";

test("deal type labels are shared and do not contain emoji", () => {
  assert.equal(russianMessages.DealType.SafeDeal, "Безопасная сделка");
  assert.equal(englishMessages.DealType.SafeDeal, "Secure deal");

  for (const messages of [russianMessages, englishMessages]) {
    assert.doesNotMatch(messages.DealType.SafeDeal, /🛡|💸/u);
    assert.doesNotMatch(messages.DealType.DirectDeal, /🛡|💸/u);
  }
});
