import assert from "node:assert/strict";
import test from "node:test";

import {
  appendTelegramCaptionLink,
  extractTelegramInlineKeyboard,
  extractTelegramMediaGroupMessageIds,
  extractTelegramPostCaption,
  isTelegramMediaGroupPost,
} from "../../src/shared/lib/telegram/post.server";
import {
  canTelegramChatMemberEditChannel,
  classifyTelegramCaptionEditFailure,
  classifyTelegramReplyMarkupEditFailure,
} from "../../src/shared/lib/telegram/bot";

test("Telegram post buttons preserve their original rows and URLs", () => {
  const result = extractTelegramInlineKeyboard(`
    <article class="tgme_widget_message">
      <div class="tgme_widget_message_inline_keyboard">
        <div class="tgme_widget_message_inline_keyboard_row">
          <a class="tgme_widget_message_inline_button" href="https://example.com/first">
            First button
          </a>
          <a class="tgme_widget_message_inline_button" href="tg://resolve?domain=FavorDealsBot">
            Open bot
          </a>
        </div>
        <div class="tgme_widget_message_inline_keyboard_row">
          <a class="tgme_widget_message_inline_button" href="https://example.com/second">
            Second button
          </a>
        </div>
      </div>
    </article>
  `);

  assert.equal(result.isInlineKeyboardComplete, true);
  assert.deepEqual(result.inlineKeyboard, [
    [
      { text: "First button", url: "https://example.com/first" },
      { text: "Open bot", url: "tg://resolve?domain=FavorDealsBot" },
    ],
    [{ text: "Second button", url: "https://example.com/second" }],
  ]);
});

test("Telegram post button extraction refuses to overwrite unknown button types", () => {
  const result = extractTelegramInlineKeyboard(`
    <article class="tgme_widget_message">
      <div class="tgme_widget_message_inline_keyboard_row">
        <button class="tgme_widget_message_inline_button">Callback action</button>
      </div>
    </article>
  `);

  assert.equal(result.isInlineKeyboardComplete, false);
  assert.deepEqual(result.inlineKeyboard, []);
});

test("Telegram posts without buttons produce a complete empty keyboard", () => {
  const result = extractTelegramInlineKeyboard(`
    <article class="tgme_widget_message">
      <p class="tgme_widget_message_text">A post without buttons</p>
    </article>
  `);

  assert.equal(result.isInlineKeyboardComplete, true);
  assert.deepEqual(result.inlineKeyboard, []);
});

test("Telegram media albums are detected before trying to attach a button", () => {
  assert.equal(
    isTelegramMediaGroupPost(`
      <article class="tgme_widget_message">
        <div class="tgme_widget_message_grouped_wrap">
          <a class="grouped_media_wrap"></a>
          <a class="grouped_media_wrap"></a>
          <a class="grouped_media_wrap"></a>
        </div>
      </article>
    `),
    true,
  );
  assert.equal(
    isTelegramMediaGroupPost(`
      <article class="tgme_widget_message">
        <a class="tgme_widget_message_photo_wrap"></a>
      </article>
    `),
    false,
  );
});

test("Telegram album message ids are read from the grouped media links", () => {
  assert.deepEqual(
    extractTelegramMediaGroupMessageIds(`
      <article class="tgme_widget_message">
        <div class="tgme_widget_message_grouped_wrap">
          <a class="grouped_media_wrap" href="https://t.me/favor/507?single"></a>
          <a class="grouped_media_wrap" href="https://t.me/favor/508?single"></a>
          <a class="grouped_media_wrap" href="https://t.me/favor/509?single"></a>
        </div>
      </article>
    `),
    [507, 508, 509],
  );
});

test("Telegram captions retain supported formatting and safe links", () => {
  const caption = extractTelegramPostCaption(`
    <article class="tgme_widget_message">
      <div class="tgme_widget_message_text"><div class="tgme_widget_message_text"><i class="emoji"><b>🎵</b></i> <strong>Promo</strong><br><a href="https://example.com/profile" target="_blank">Profile</a><br><a href="?q=%23promo">#promo</a></div></div>
    </article>
  `);

  assert.equal(
    caption.html,
    '🎵 <b>Promo</b>\n<a href="https://example.com/profile">Profile</a>\n#promo',
  );
  assert.equal(caption.plainText, "🎵 Promo\nProfile\n#promo");
  assert.deepEqual(caption.links, ["https://example.com/profile"]);
});

test("a formatted contract link is appended to an album caption only once", () => {
  const firstResult = appendTelegramCaptionLink({
    caption: { html: "Album caption", plainText: "Album caption", links: [] },
    text: "Открыть контракт в Favor",
    url: "https://t.me/FavorDealsBot/app?startapp=contract_test",
  });

  assert.deepEqual(firstResult, {
    status: "updated",
    html: 'Album caption\n\n🔗 <a href="https://t.me/FavorDealsBot/app?startapp=contract_test">Открыть контракт в Favor</a>',
  });

  assert.deepEqual(
    appendTelegramCaptionLink({
      caption: {
        html: firstResult.status === "updated" ? firstResult.html : "",
        plainText: "Album caption\n\n🔗 Открыть контракт в Favor",
        links: ["https://t.me/FavorDealsBot/app?startapp=contract_test"],
      },
      text: "Открыть контракт в Favor",
      url: "https://t.me/FavorDealsBot/app?startapp=contract_test",
    }),
    {
      status: "unchanged",
      html: firstResult.status === "updated" ? firstResult.html : "",
    },
  );
});

test("only channel owners and editors may request a contract button", () => {
  assert.equal(canTelegramChatMemberEditChannel({ status: "creator" }), true);
  assert.equal(
    canTelegramChatMemberEditChannel({
      status: "administrator",
      can_edit_messages: true,
    }),
    true,
  );
  assert.equal(
    canTelegramChatMemberEditChannel({
      status: "administrator",
      can_edit_messages: false,
    }),
    false,
  );
  assert.equal(canTelegramChatMemberEditChannel({ status: "member" }), false);
});

test("an idempotent Telegram reply-markup edit is treated as unchanged", () => {
  assert.deepEqual(
    classifyTelegramReplyMarkupEditFailure(
      "Bad Request: message is not modified: specified new message content and reply markup are exactly the same",
    ),
    { status: "unchanged" },
  );
});

test("Telegram reply-markup failures retain an actionable reason", () => {
  assert.deepEqual(
    classifyTelegramReplyMarkupEditFailure("Bad Request: message to edit not found"),
    { status: "failed", reason: "telegram_post_cannot_be_edited" },
  );
  assert.deepEqual(
    classifyTelegramReplyMarkupEditFailure("Bad Request: BUTTON_URL_INVALID"),
    { status: "failed", reason: "telegram_button_is_invalid" },
  );
  assert.deepEqual(
    classifyTelegramReplyMarkupEditFailure("Bad Request: not enough rights to edit messages"),
    { status: "failed", reason: "telegram_bot_cannot_edit_channel" },
  );
});

test("Telegram caption formatting failures retain an actionable reason", () => {
  assert.deepEqual(
    classifyTelegramCaptionEditFailure(
      "Bad Request: can't parse entities: Unsupported start tag",
    ),
    { status: "failed", reason: "telegram_caption_is_invalid" },
  );
});
