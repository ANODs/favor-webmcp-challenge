import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

const TEST_BOT_TOKEN = "telegram-auth-parser-test-token";

process.env.TELEGRAM_BOT_TOKEN = TEST_BOT_TOKEN;

const createCheckString = (params: URLSearchParams) =>
  [...params.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

const signTelegramInitData = (user: Record<string, unknown>) => {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: "telegram-auth-parser-query",
    user: JSON.stringify(user),
  });
  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(TEST_BOT_TOKEN)
    .digest();
  const hash = crypto
    .createHmac("sha256", secretKey)
    .update(createCheckString(params))
    .digest("hex");

  params.set("hash", hash);
  return params.toString();
};

const baseTelegramUser = {
  id: 476_898_212,
  username: "favor_user",
  first_name: "Favor",
};

test("Telegram auth parser returns allowsWriteToPm=true from signed user data", async () => {
  const { verifyTelegramInitData } = await import("../../src/shared/lib/telegram/auth");
  const result = verifyTelegramInitData(
    signTelegramInitData({
      ...baseTelegramUser,
      allows_write_to_pm: true,
    }),
  );

  assert.equal(result.telegramId, 476_898_212n);
  assert.equal(result.username, "favor_user");
  assert.equal(result.allowsWriteToPm, true);
});

test("Telegram auth parser preserves allows_write_to_pm=false", async () => {
  const { verifyTelegramInitData } = await import("../../src/shared/lib/telegram/auth");
  const result = verifyTelegramInitData(
    signTelegramInitData({
      ...baseTelegramUser,
      allows_write_to_pm: false,
    }),
  );

  assert.equal(result.allowsWriteToPm, false);
});

test("Telegram auth parser defaults absent allows_write_to_pm to false", async () => {
  const { verifyTelegramInitData } = await import("../../src/shared/lib/telegram/auth");
  const result = verifyTelegramInitData(signTelegramInitData(baseTelegramUser));

  assert.equal(result.allowsWriteToPm, false);
});

test("Telegram auth parser rejects a user payload changed after signing", async () => {
  const { verifyTelegramInitData } = await import("../../src/shared/lib/telegram/auth");
  const params = new URLSearchParams(
    signTelegramInitData({
      ...baseTelegramUser,
      allows_write_to_pm: true,
    }),
  );
  params.set(
    "user",
    JSON.stringify({
      ...baseTelegramUser,
      allows_write_to_pm: false,
    }),
  );

  assert.throws(
    () => verifyTelegramInitData(params.toString()),
    /Telegram initData signature is invalid/,
  );
});
