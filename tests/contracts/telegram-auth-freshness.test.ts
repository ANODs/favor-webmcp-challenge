import assert from "node:assert/strict";
import test from "node:test";

import { isTelegramAuthDateFresh } from "../../src/shared/lib/telegram/auth";

test("Telegram auth data accepts a recent timestamp", () => {
  assert.equal(isTelegramAuthDateFresh(9_900, 10_000), true);
});

test("Telegram auth data rejects stale and implausibly future timestamps", () => {
  assert.equal(isTelegramAuthDateFresh(6_000, 10_000), false);
  assert.equal(isTelegramAuthDateFresh(10_061, 10_000), false);
  assert.equal(isTelegramAuthDateFresh(Number.NaN, 10_000), false);
});
