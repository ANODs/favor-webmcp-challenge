/* eslint-disable @typescript-eslint/no-require-imports */
const path = require("node:path");

const { env } = require("../../shared/config/env");
const { buildSettingsUrl } = require("../../shared/lib/links");
const {
  sendRichMessage,
  sendRichVideoMessage,
} = require("../../shared/lib/telegram-api");
const {
  SUBSCRIPTION_GIFT_VIDEO,
  buildSubscriptionGiftNotification,
} = require("../../../../src/entities/subscription/gift-notification.cjs");

const DEFAULT_GIFT_VIDEO_PATH = path.resolve(
  __dirname,
  "../../../assets",
  SUBSCRIPTION_GIFT_VIDEO.filename,
);

async function notifySubscriptionGiftRecipient(result, dependencies = {}) {
  if (
    !result.activated ||
    !result.newlyConfirmed ||
    !result.isGift ||
    !result.recipient?.telegramId
  ) {
    return { sent: false, reason: "not_new_gift" };
  }

  const deliverRichVideo =
    dependencies.sendRichVideoMessage || sendRichVideoMessage;
  const deliverRichMessage = dependencies.sendRichMessage || sendRichMessage;
  const logError = dependencies.logError || console.error;
  const notification = buildSubscriptionGiftNotification({
    locale: result.recipient.languageCode,
    payerName: result.payer?.displayName,
    premiumExpiresAt: result.premiumExpiresAt,
    settingsUrl: buildSettingsUrl(
      dependencies.botUsername || env.telegramBotUsername,
    ),
  });

  try {
    const richVideoResult = await deliverRichVideo(
      result.recipient.telegramId.toString(),
      notification.html,
      dependencies.videoPath || DEFAULT_GIFT_VIDEO_PATH,
      SUBSCRIPTION_GIFT_VIDEO,
    );

    if (!richVideoResult) {
      throw new Error("Telegram did not accept the gift rich video message");
    }

    return { sent: true, transport: "rich_video" };
  } catch (error) {
    logError("[favor-bot] failed to send subscription gift rich video", {
      intentRecipientId: result.recipient.id,
      error,
    });
  }

  try {
    const richResult = await deliverRichMessage(
      result.recipient.telegramId.toString(),
      notification.fallbackHtml,
    );

    if (!richResult) {
      throw new Error("Telegram did not accept the gift rich message fallback");
    }

    return { sent: true, transport: "rich" };
  } catch (error) {
    logError("[favor-bot] failed to notify subscription gift recipient", {
      intentRecipientId: result.recipient.id,
      error,
    });
    return { sent: false, reason: "delivery_failed" };
  }
}

module.exports = {
  buildSubscriptionGiftNotification,
  notifySubscriptionGiftRecipient,
};
