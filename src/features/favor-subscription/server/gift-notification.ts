import { readFile } from "node:fs/promises";
import path from "node:path";

import { PaymentIntentStatus, PaymentProduct } from "@prisma/client";

import {
  SUBSCRIPTION_GIFT_VIDEO,
  buildSubscriptionGiftNotification,
} from "@/entities/subscription/gift-notification";
import { env } from "@/shared/config/env";
import { prisma } from "@/shared/lib/prisma";
import {
  TELEGRAM_MINI_APP_START_PARAMS,
  buildTelegramMiniAppUrl,
} from "@/shared/lib/telegram";
import {
  sendTelegramBotRichMessage,
  sendTelegramBotRichVideoMessage,
} from "@/shared/lib/telegram/server";

type GiftNotificationParty = {
  id: number;
  name: string | null;
  telegramUsername: string | null;
  telegramFirstName: string | null;
  telegramLastName: string | null;
};

type ConfirmedGiftNotificationIntent = {
  userId: number;
  beneficiaryUserId: number | null;
  user: GiftNotificationParty;
  beneficiary: {
    id: number;
    telegramId: bigint;
    languageCode: string | null;
  } | null;
  subscriptionPurchase: {
    endsAt: Date;
  } | null;
};

type GiftNotificationDependencies = {
  loadConfirmedIntent?: (
    intentId: string,
  ) => Promise<ConfirmedGiftNotificationIntent | null>;
  loadVideo?: () => Promise<Uint8Array>;
  sendRichMessage?: typeof sendTelegramBotRichMessage;
  sendRichVideo?: typeof sendTelegramBotRichVideoMessage;
  botUsername?: string;
  logError?: (message: string, context: Record<string, unknown>) => void;
};

export type SubscriptionGiftNotificationResult =
  | { sent: true }
  | {
      sent: false;
      reason: "not_new_gift" | "gift_not_found" | "delivery_failed";
    };

const loadConfirmedSubscriptionGift = (intentId: string) =>
  prisma.paymentIntent.findFirst({
    where: {
      id: intentId,
      product: PaymentProduct.subscription,
      status: PaymentIntentStatus.confirmed,
    },
    select: {
      userId: true,
      beneficiaryUserId: true,
      user: {
        select: {
          id: true,
          name: true,
          telegramUsername: true,
          telegramFirstName: true,
          telegramLastName: true,
        },
      },
      beneficiary: {
        select: {
          id: true,
          telegramId: true,
          languageCode: true,
        },
      },
      subscriptionPurchase: {
        select: { endsAt: true },
      },
    },
  });

const loadSubscriptionGiftVideo = () =>
  readFile(
    path.resolve(
      process.cwd(),
      "bot",
      "assets",
      SUBSCRIPTION_GIFT_VIDEO.filename,
    ),
  );

const getPayerDisplayName = (payer: GiftNotificationParty) => {
  const telegramName = [payer.telegramFirstName, payer.telegramLastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  return (
    payer.name?.trim() ||
    telegramName ||
    (payer.telegramUsername ? `@${payer.telegramUsername}` : null)
  );
};

export async function notifyConfirmedSubscriptionGift(
  {
    intentId,
    newlyConfirmed,
  }: {
    intentId: string;
    newlyConfirmed: boolean;
  },
  dependencies: GiftNotificationDependencies = {},
): Promise<SubscriptionGiftNotificationResult> {
  if (!newlyConfirmed) {
    return { sent: false, reason: "not_new_gift" };
  }

  const loadIntent =
    dependencies.loadConfirmedIntent ?? loadConfirmedSubscriptionGift;
  const loadVideo = dependencies.loadVideo ?? loadSubscriptionGiftVideo;
  const deliverRichVideo =
    dependencies.sendRichVideo ?? sendTelegramBotRichVideoMessage;
  const deliverRichMessage =
    dependencies.sendRichMessage ?? sendTelegramBotRichMessage;
  const logError = dependencies.logError ?? console.error;

  try {
    const intent = await loadIntent(intentId);

    if (
      !intent ||
      !intent.beneficiary ||
      !intent.subscriptionPurchase ||
      intent.userId === intent.beneficiaryUserId
    ) {
      return { sent: false, reason: "gift_not_found" };
    }

    const notification = buildSubscriptionGiftNotification({
      locale: intent.beneficiary.languageCode,
      payerName: getPayerDisplayName(intent.user),
      premiumExpiresAt: intent.subscriptionPurchase.endsAt,
      settingsUrl: buildTelegramMiniAppUrl(
        dependencies.botUsername ?? env.telegramBotUsername,
        TELEGRAM_MINI_APP_START_PARAMS.settings,
      ),
    });

    try {
      const video = await loadVideo();
      const delivered = await deliverRichVideo({
        chatId: intent.beneficiary.telegramId.toString(),
        html: notification.html,
        video,
        ...SUBSCRIPTION_GIFT_VIDEO,
      });

      if (delivered) {
        return { sent: true };
      }

      throw new Error("Telegram did not accept the gift rich video message");
    } catch (error) {
      logError("[favor-subscription] failed to send gift rich video", {
        intentId,
        error,
      });
    }

    const delivered = await deliverRichMessage({
      chatId: intent.beneficiary.telegramId.toString(),
      html: notification.fallbackHtml,
    });

    return delivered
      ? { sent: true }
      : { sent: false, reason: "delivery_failed" };
  } catch (error) {
    logError("[favor-subscription] failed to notify gift recipient", {
      intentId,
      error,
    });
    return { sent: false, reason: "delivery_failed" };
  }
}
