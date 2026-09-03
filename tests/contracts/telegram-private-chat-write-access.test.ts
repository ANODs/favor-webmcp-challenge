import assert from "node:assert/strict";
import test from "node:test";

import { classifyTelegramPrivateChatWriteAccessFailure } from "../../src/shared/lib/telegram/server";

test("private Telegram chat access treats missing chats and users as denied", () => {
  for (const description of [
    "Bad Request: chat not found",
    "Bad Request: USER_NOT_FOUND",
    "Bad Request: PEER_ID_INVALID",
  ]) {
    assert.deepEqual(
      classifyTelegramPrivateChatWriteAccessFailure({
        errorCode: 400,
        description,
      }),
      { status: "denied", reason: "chat_not_found" },
    );
  }
});

test("private Telegram chat access classifies permanent 403 failures", () => {
  assert.deepEqual(
    classifyTelegramPrivateChatWriteAccessFailure({
      errorCode: 403,
      description: "Forbidden: bot was blocked by the user",
    }),
    { status: "denied", reason: "bot_blocked" },
  );
  assert.deepEqual(
    classifyTelegramPrivateChatWriteAccessFailure({
      errorCode: 403,
      description: "Forbidden: user is deactivated",
    }),
    { status: "denied", reason: "user_deactivated" },
  );
  assert.deepEqual(
    classifyTelegramPrivateChatWriteAccessFailure({
      errorCode: 403,
      description: "Forbidden",
    }),
    { status: "denied", reason: "forbidden" },
  );
});

test("private Telegram chat access keeps transient and unexpected failures unavailable", () => {
  assert.deepEqual(
    classifyTelegramPrivateChatWriteAccessFailure({ errorCode: 429 }),
    { status: "unavailable", reason: "rate_limited" },
  );
  assert.deepEqual(
    classifyTelegramPrivateChatWriteAccessFailure({ errorCode: 503 }),
    { status: "unavailable", reason: "telegram_server_error" },
  );
  assert.deepEqual(
    classifyTelegramPrivateChatWriteAccessFailure({
      errorCode: 400,
      description: "Bad Request: unexpected payload",
    }),
    { status: "unavailable", reason: "unexpected_response" },
  );
});
