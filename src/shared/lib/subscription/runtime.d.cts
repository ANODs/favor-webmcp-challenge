export type DateCompatible = Date | string | number;

export const SUBSCRIPTION_DURATIONS: readonly ["1m", "1y"];
export type SubscriptionDuration = (typeof SUBSCRIPTION_DURATIONS)[number];
export const MONTHLY_SUBSCRIPTION_DURATION: (typeof SUBSCRIPTION_DURATIONS)[0];
export const YEARLY_SUBSCRIPTION_DURATION: (typeof SUBSCRIPTION_DURATIONS)[1];
export const FAVOR_SUBSCRIPTION_DURATION: typeof YEARLY_SUBSCRIPTION_DURATION;

export function parseSubscriptionDuration(value: unknown): SubscriptionDuration;

export function addSubscriptionPeriod(
  from: DateCompatible,
  duration: unknown,
): Date;

export function resolveSubscriptionPeriod(input: {
  paymentAt: DateCompatible;
  currentExpiresAt?: DateCompatible | null;
  duration: unknown;
}): {
  startsAt: Date;
  endsAt: Date;
};
