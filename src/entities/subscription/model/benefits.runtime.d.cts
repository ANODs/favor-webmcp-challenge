export type SubscriptionBenefitId =
  | "active_contracts"
  | "scout_contracts"
  | "contact_views"
  | "feed_priority"
  | "og_previews";

export type SubscriptionBenefitValue =
  | number
  | "limited"
  | "unlimited"
  | boolean;

export type SubscriptionBenefit =
  | Readonly<{
      id: "active_contracts" | "scout_contracts";
      free: number;
      plus: number;
    }>
  | Readonly<{
      id: "contact_views";
      free: "limited";
      plus: "unlimited";
    }>
  | Readonly<{
      id: "feed_priority" | "og_previews";
      free: false;
      plus: true;
    }>;

export const SUBSCRIPTION_BENEFITS: readonly SubscriptionBenefit[];
