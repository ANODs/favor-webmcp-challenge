import { env } from "@/shared/config/env";
import {
  FAVOR_SUBSCRIPTION_DURATION,
  YEARLY_SUBSCRIPTION_DURATION,
  type SubscriptionDuration,
} from "@/shared/lib/subscription";

const clampPercent = (value: number) => Math.min(100, Math.max(0, value));
const requirePositivePrice = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("INVALID_SUBSCRIPTION_PRICE_CONFIGURATION");
  }

  return value;
};

export const getSubscriptionDiscounts = () => ({
  yearlyPercent: clampPercent(env.subscriptionYearlyDiscountPercent),
  favorPercent: clampPercent(env.subscriptionFavorDiscountPercent),
});

export const getSubscriptionPriceUsdt = (
  duration: SubscriptionDuration,
  asset?: "FAVOR",
) => {
  const discounts = getSubscriptionDiscounts();
  const yearlyMultiplier = 12 * (1 - discounts.yearlyPercent / 100);
  const durationMultiplier = duration === YEARLY_SUBSCRIPTION_DURATION
    ? yearlyMultiplier
    : 1;
  const favorMultiplier = asset === "FAVOR"
    ? 1 - discounts.favorPercent / 100
    : 1;

  return requirePositivePrice(
    env.subscriptionMonthlyPriceUsdt * durationMultiplier * favorMultiplier,
  );
};

export const getSubscriptionPriceStars = (duration: SubscriptionDuration) => {
  const starsPerUsdt = requirePositivePrice(env.telegramStarsPerUsdt);
  const amount = Math.ceil(getSubscriptionPriceUsdt(duration) * starsPerUsdt);

  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error("INVALID_SUBSCRIPTION_PRICE_CONFIGURATION");
  }

  return amount;
};

export const getSubscriptionPriceGram = (
  duration: SubscriptionDuration,
  gramPriceUsdt: number,
) => requirePositivePrice(getSubscriptionPriceUsdt(duration) / requirePositivePrice(gramPriceUsdt));

export const getSubscriptionPriceFavor = (favorPriceUsdt: number) =>
  requirePositivePrice(
    getSubscriptionPriceUsdt(FAVOR_SUBSCRIPTION_DURATION, "FAVOR") /
      requirePositivePrice(favorPriceUsdt),
  );
