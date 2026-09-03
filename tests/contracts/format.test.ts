import assert from "node:assert/strict";
import test from "node:test";

import {
  formatCurrency,
  formatDurationMinutes,
} from "../../src/shared/lib/format";
import {
  formatDealAssetAmount,
  getEscrowSettlementBreakdown,
} from "../../src/entities/deal/model/settlement";

test("currency formatting preserves fractional deal prices", () => {
  assert.match(formatCurrency(0.1, "ru-RU"), /0,1/);
  assert.equal(formatDealAssetAmount(1, "TON", "ru-RU"), "1,00 GRAM");
});

test("shared formatters select their copy from the requested locale", () => {
  assert.equal(formatCurrency(null, "en-US"), "Not specified");
  assert.equal(formatCurrency(null, "ru-RU"), "Не указано");
  assert.equal(formatDurationMinutes(1_500, "en"), "1d 1h");
  assert.equal(formatDurationMinutes(1_500, "ru"), "1 дн. 1 ч.");
});

test("USDT scout settlement displays the exact 95/1/4 distribution", () => {
  assert.deepEqual(
    getEscrowSettlementBreakdown({ price: "0.1", referralRewardPercent: "20" }),
    {
      totalAmount: 0.1,
      freelancerAmount: 0.095,
      scoutAmount: 0.001,
      platformAmount: 0.004,
      freelancerPercent: 95,
      scoutPercent: 1,
      platformPercent: 4,
    },
  );
  assert.equal(formatDealAssetAmount(0.001, "USDT", "ru-RU"), "0,001 USDT");
});
