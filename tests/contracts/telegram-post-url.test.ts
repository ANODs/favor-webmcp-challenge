import assert from "node:assert/strict";
import test from "node:test";

import { parseTelegramPostUrl } from "../../src/shared/lib/telegram/post";

test("Telegram work-post URLs canonicalize public channel and topic links", () => {
  const parsed = parseTelegramPostUrl(
    "https://t.me/s/example_channel/12/123",
  );

  assert.equal(
    parsed.canonicalPostUrl,
    "https://t.me/example_channel/12/123",
  );
  assert.match(
    parsed.publicFeedPostUrl,
    /^https:\/\/t\.me\/example_channel\/12\/123\?embed=1&t=\d+$/,
  );
  assert.equal(
    parsed.canonicalSinglePostUrl,
    "https://t.me/example_channel/12/123?single",
  );
  assert.equal(parsed.channelUrl, "https://t.me/example_channel");
  assert.equal(parsed.channelHandle, "example_channel");
  assert.equal(parsed.postId, "123");
});

test("Telegram service routes are not accepted as work posts", () => {
  assert.throws(
    () => parseTelegramPostUrl("https://t.me/share/url"),
    /TELEGRAM_POST_PATH_INVALID/,
  );
  assert.throws(
    () => parseTelegramPostUrl("https://t.me/example_channel/not-a-message"),
    /TELEGRAM_POST_PATH_INVALID/,
  );
});
