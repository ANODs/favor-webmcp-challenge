import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

import { buildCenteredTelegramRichMessageUrlButtonRow } from "../../src/shared/lib/telegram/rich-message";

const require = createRequire(import.meta.url);
const {
  buildCenteredRichMessageUrlButtonRow,
} = require("../../bot/src/shared/lib/rich-message") as {
  buildCenteredRichMessageUrlButtonRow: (
    buttons: Array<{
      text: string;
      url: string;
      style?: string;
    }>,
  ) => string;
};
const { buildReplyByPayload } = require(
  "../../bot/src/features/handle-start-command",
) as {
  buildReplyByPayload: (
    botUsername: string,
    payload: string,
    locale?: "ru" | "en",
  ) => {
    richHtml?: string;
    buttons: Array<Record<string, unknown>>;
    fallbackButtons?: Array<Record<string, unknown>>;
  };
};

test("rich message URL button rows are centered, styled, and escaped", () => {
  const html = buildCenteredRichMessageUrlButtonRow([
    {
      text: 'Open <Favor> & "go"',
      url: "https://favor.deals/en/contracts/design?from=bot&source=start",
      style: "success",
    },
    {
      text: "Settings",
      url: "tg://resolve?domain=FavorDealsBot&startapp=settings",
      style: "default",
    },
  ]);

  assert.equal(
    html,
    '<tg-button-row align="center"><tg-button type="url" style="success" url="https://favor.deals/en/contracts/design?from=bot&amp;source=start">Open &lt;Favor&gt; &amp; &quot;go&quot;</tg-button><tg-button type="url" url="tg://resolve?domain=FavorDealsBot&amp;startapp=settings">Settings</tg-button></tg-button-row>',
  );
});

test("app and bot rich message helpers render the same branded button row", () => {
  const buttons = [
    {
      text: "Start a deal",
      url: "https://t.me/FavorDealsBot?startapp=contract_deal_design&ref=42",
      style: "success" as const,
    },
    {
      text: "Open contract",
      url: "https://favor.deals/en/contracts/design",
      style: "primary" as const,
    },
  ];

  assert.equal(
    buildCenteredTelegramRichMessageUrlButtonRow(buttons),
    buildCenteredRichMessageUrlButtonRow(buttons),
  );
});

test("rich message URL button rows reject unsafe or unsupported input", () => {
  assert.equal(buildCenteredRichMessageUrlButtonRow([]), "");
  assert.equal(buildCenteredTelegramRichMessageUrlButtonRow([]), "");
  assert.throws(
    () =>
      buildCenteredRichMessageUrlButtonRow([
        { text: "Unsafe", url: "javascript:alert(1)", style: "primary" },
      ]),
    /unsupported protocol/,
  );
  assert.throws(
    () =>
      buildCenteredTelegramRichMessageUrlButtonRow([
        { text: "Unsafe", url: "javascript:alert(1)", style: "primary" },
      ]),
    /unsupported protocol/,
  );
  assert.throws(
    () =>
      buildCenteredRichMessageUrlButtonRow([
        {
          text: "Danger",
          url: "https://favor.deals",
          style: "danger",
        },
      ]),
    /Unsupported rich message button style/,
  );
  assert.throws(
    () =>
      buildCenteredTelegramRichMessageUrlButtonRow([
        {
          text: "Danger",
          url: "https://favor.deals",
          style: "danger" as never,
        },
      ]),
    /Unsupported rich message button style/,
  );
});

test("default start reply embeds branded buttons and keeps reply markup empty", () => {
  const reply = buildReplyByPayload("FavorDealsBot", "", "en");
  const html = reply.richHtml ?? "";

  assert.match(html, /<tg-button-row align="center">/);
  assert.match(html, /style="success"[^>]*>Open feed<\/tg-button>/);
  assert.match(html, /style="primary"[^>]*>My deals<\/tg-button>/);
  assert.match(html, /<tg-button type="url" url="[^"]+">Settings<\/tg-button>/);
  assert.deepEqual(reply.buttons, []);
  assert.equal(reply.fallbackButtons?.length, 3);
  assert.equal(
    reply.fallbackButtons?.every((button) => button.style === undefined),
    true,
  );
});

test("unknown start payload embeds the fallback navigation buttons", () => {
  const reply = buildReplyByPayload("FavorDealsBot", "legacy-payload", "en");
  const html = reply.richHtml ?? "";

  assert.match(html, />Enable notifications<\/tg-button>/);
  assert.match(html, />Open feed<\/tg-button>/);
  assert.match(html, />Open deals<\/tg-button>/);
  assert.doesNotMatch(html, />Settings<\/tg-button>/);
  assert.deepEqual(reply.buttons, []);
});
