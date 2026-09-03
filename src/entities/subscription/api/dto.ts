import type { SubscriptionDuration } from "@/shared/lib/subscription";

export type SubscriptionBenefitDto = {
  id:
    | "active_contracts"
    | "scout_contracts"
    | "contact_views"
    | "feed_priority"
    | "og_previews";
  free: number | "limited" | boolean;
  plus: number | "unlimited" | boolean;
};

export type SubscriptionOfferPlanDto = {
  duration: SubscriptionDuration;
  priceUsdt: number;
  telegramStars: { amount: number };
  gram: { amount: string; amountNano: string };
  favor: { amount: string; amountNano: string; priceUsdt: number } | null;
};

export type FavorSubscriptionRateDto = {
  favorPriceInTon: number;
  favorPriceUsdt: number;
  gramPriceUsdt: number;
  yearlyPriceTon: number;
  discountedPriceTon: number;
  yearlyPriceUsdt: number;
  discountedPriceUsdt: number;
  favorAmount: number;
};

export type SubscriptionOfferDto = {
  plans: SubscriptionOfferPlanDto[];
  benefits: SubscriptionBenefitDto[];
  discounts: {
    yearlyPercent: number;
    favorPercent: number;
  };
  favorRate: FavorSubscriptionRateDto | null;
};
