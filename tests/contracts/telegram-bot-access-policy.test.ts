import assert from "node:assert/strict";
import test from "node:test";

import { TELEGRAM_BOT_ACCESS_ERROR_CODES } from "../../src/entities/user/lib/telegram-bot-access";
import { getTelegramBotAccessError } from "../../src/entities/user/server";

test("allowed Telegram bot access does not produce a domain error", () => {
  assert.equal(getTelegramBotAccessError({ status: "allowed" }), null);
});

test("a current user without a writable bot chat receives the recovery error", () => {
  const error = getTelegramBotAccessError({
    status: "denied",
    reason: "chat_not_found",
  });

  assert.equal(error?.code, TELEGRAM_BOT_ACCESS_ERROR_CODES.chatRequired);
  assert.equal(error?.status, 403);
});

test("an unavailable contract author is reported without exposing Telegram details", () => {
  const error = getTelegramBotAccessError(
    { status: "denied", reason: "bot_blocked" },
    "contract_author",
  );

  assert.equal(
    error?.code,
    TELEGRAM_BOT_ACCESS_ERROR_CODES.contractAuthorUnavailable,
  );
  assert.equal(error?.status, 409);
  assert.equal(error?.details, undefined);
});

test("transient Telegram failures fail closed with a retryable service error", () => {
  const error = getTelegramBotAccessError({
    status: "unavailable",
    reason: "rate_limited",
  });

  assert.equal(error?.code, TELEGRAM_BOT_ACCESS_ERROR_CODES.unavailable);
  assert.equal(error?.status, 503);
});
