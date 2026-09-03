import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { buildReplyByPayload } = require(
  "../../bot/src/features/handle-start-command",
) as {
  buildReplyByPayload: (
    botUsername: string,
    payload: string,
    locale?: "ru" | "en",
  ) => { text: string; richHtml?: string };
};

test("default bot reply uses Telegram rich formatting and explains reports", () => {
  const reply = buildReplyByPayload("FavorDealsBot", "");

  assert.match(reply.richHtml ?? "", /<h1>Favor Deals<\/h1>/);
  assert.match(reply.richHtml ?? "", /<h2>Сообщить о проблеме<\/h2>/);
  assert.match(reply.richHtml ?? "", /<code>\/report<\/code>/);
  assert.match(reply.richHtml ?? "", /не загружаются в Favor/);
  assert.match(reply.text, /\/report/);
});

test("default bot reply follows the saved English locale", () => {
  const reply = buildReplyByPayload("FavorDealsBot", "", "en");

  assert.match(reply.richHtml ?? "", /<h2>Report a problem<\/h2>/);
  assert.match(reply.richHtml ?? "", /<code>\/report<\/code>/);
  assert.match(reply.richHtml ?? "", /not uploaded to Favor/);
  assert.doesNotMatch(reply.richHtml ?? "", /Сообщить о проблеме/);
});
