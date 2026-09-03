import assert from "node:assert/strict";
import test from "node:test";

import {
  SUBSCRIPTION_GIFT_VIDEO,
  buildSubscriptionGiftNotification,
} from "../../src/entities/subscription/gift-notification";
import { SUBSCRIPTION_BENEFITS } from "../../src/entities/subscription/model/benefits";
import { buildTelegramRichVideoInput } from "../../src/shared/lib/telegram/rich-message.runtime.cjs";

test("gift rich message derives every displayed benefit from the canonical catalog", () => {
  const notification = buildSubscriptionGiftNotification({
    locale: "ru",
    payerName: "<Отправитель>",
    premiumExpiresAt: new Date("2027-08-27T12:00:00.000Z"),
    settingsUrl:
      "https://t.me/FavorDealsBot?startapp=settings&source=<gift>",
  });

  assert.deepEqual(
    notification.benefits.map(({ id }) => id),
    SUBSCRIPTION_BENEFITS.map(({ id }) => id),
  );
  assert.ok(
    notification.html.startsWith(
      `<video src="tg://video?id=${SUBSCRIPTION_GIFT_VIDEO.mediaId}"></video>`,
    ),
  );
  assert.doesNotMatch(notification.fallbackHtml, /<video/);
  assert.match(notification.html, /&lt;Отправитель&gt;/);
  assert.doesNotMatch(notification.html, /<Отправитель>/);
  assert.match(notification.html, /source=&lt;gift&gt;/);
  assert.ok(notification.html.endsWith("</tg-button-row>"));
});

test("Telegram rich video input is an MP4 video attachment, not an animation", () => {
  const notification = buildSubscriptionGiftNotification({
    locale: "en",
    payerName: "Payer",
    settingsUrl: "https://t.me/FavorDealsBot?startapp=settings",
  });
  const richMessage = buildTelegramRichVideoInput({
    html: notification.html,
    mediaId: SUBSCRIPTION_GIFT_VIDEO.mediaId,
    attachmentName: SUBSCRIPTION_GIFT_VIDEO.attachmentName,
    width: SUBSCRIPTION_GIFT_VIDEO.width,
    height: SUBSCRIPTION_GIFT_VIDEO.height,
    duration: SUBSCRIPTION_GIFT_VIDEO.duration,
  });

  assert.deepEqual(richMessage.media, [
    {
      id: "favor_plus_gift_video",
      media: {
        type: "video",
        media: "attach://favor_plus_gift_video_file",
        supports_streaming: true,
        width: 720,
        height: 720,
        duration: 6,
      },
    },
  ]);
  assert.doesNotMatch(
    JSON.stringify(richMessage.media),
    /"type":"animation"|\.gif(?:"|\?)/i,
  );
});
