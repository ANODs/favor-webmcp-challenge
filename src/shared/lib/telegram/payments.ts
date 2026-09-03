import { env } from "@/shared/config/env";
import { getSubscriptionPriceStars } from "@/shared/lib/pricing";
import {
  MONTHLY_SUBSCRIPTION_DURATION,
  YEARLY_SUBSCRIPTION_DURATION,
  type SubscriptionDuration,
} from "@/shared/lib/subscription";

import englishMessages from "./payments.en.json";
import { proxyFetch } from "./proxy-fetch";
import russianMessages from "./payments.ru.json";

const TELEGRAM_BOT_API_BASE = "https://api.telegram.org";
const TELEGRAM_STARS_CURRENCY = "XTR";
const PREMIUM_SUBSCRIPTION_PAYLOAD_PREFIX = "favor-premium";

type TelegramPrice = {
  label: string;
  amount: number;
};

type CreateTelegramInvoiceLinkParams = {
  title: string;
  description: string;
  payload: string;
  prices: TelegramPrice[];
};

type TelegramApiResponse<T> = {
  ok: boolean;
  result?: T;
  description?: string;
};

const callTelegramBotApi = async <T>(method: string, payload: Record<string, unknown>) => {
  const response = await proxyFetch(
    `${TELEGRAM_BOT_API_BASE}/bot${env.requireTelegramBotToken()}/${method}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  const data = (await response.json().catch(() => null)) as TelegramApiResponse<T> | null;

  if (!response.ok || !data?.ok || data.result === undefined) {
    throw new Error(data?.description ?? `Telegram API ${method} failed with ${response.status}`);
  }

  return data.result;
};

export const buildPremiumSubscriptionPayload = (
  userId: number,
  duration: SubscriptionDuration,
) =>
  `${PREMIUM_SUBSCRIPTION_PAYLOAD_PREFIX}:${userId}:${crypto.randomUUID()}:${duration}`;

export const isPremiumSubscriptionPayload = (payload: string) =>
  payload.startsWith(`${PREMIUM_SUBSCRIPTION_PAYLOAD_PREFIX}:`);

export const createTelegramStarsInvoiceLink = ({
  title,
  description,
  payload,
  prices,
}: CreateTelegramInvoiceLinkParams) =>
  callTelegramBotApi<string>("createInvoiceLink", {
    title,
    description,
    payload,
    currency: TELEGRAM_STARS_CURRENCY,
    prices,
  });

export type PremiumSubscriptionLocale = "ru" | "en";

export const getPremiumSubscriptionMessages = (
  locale: PremiumSubscriptionLocale,
) => (locale === "en" ? englishMessages : russianMessages);

export const getPremiumSubscriptionMonthlyPrice = (
  locale: PremiumSubscriptionLocale = "ru",
) => ({
  label: getPremiumSubscriptionMessages(locale).monthlyLabel,
  amount: getSubscriptionPriceStars(MONTHLY_SUBSCRIPTION_DURATION),
});

export const getPremiumSubscriptionYearlyPrice = (
  locale: PremiumSubscriptionLocale = "ru",
) => ({
  label: getPremiumSubscriptionMessages(locale).yearlyLabel,
  amount: getSubscriptionPriceStars(YEARLY_SUBSCRIPTION_DURATION),
});
