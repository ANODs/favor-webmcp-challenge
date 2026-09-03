export const SUBSCRIPTION_PAYMENT_STATUS = {
  created: "created",
  submitted: "submitted",
  confirmed: "confirmed",
  failed: "failed",
  expired: "expired",
} as const;

export type SubscriptionPaymentIntentStatus =
  (typeof SUBSCRIPTION_PAYMENT_STATUS)[keyof typeof SUBSCRIPTION_PAYMENT_STATUS];

export const isSubscriptionPaymentFailure = (
  status: SubscriptionPaymentIntentStatus,
) =>
  status === SUBSCRIPTION_PAYMENT_STATUS.failed ||
  status === SUBSCRIPTION_PAYMENT_STATUS.expired;
