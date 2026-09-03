"use strict";

const SUBSCRIPTION_DURATIONS = Object.freeze(["1m", "1y"]);
const MONTHLY_SUBSCRIPTION_DURATION = SUBSCRIPTION_DURATIONS[0];
const YEARLY_SUBSCRIPTION_DURATION = SUBSCRIPTION_DURATIONS[1];
const FAVOR_SUBSCRIPTION_DURATION = YEARLY_SUBSCRIPTION_DURATION;

function parseSubscriptionDuration(value) {
  if (SUBSCRIPTION_DURATIONS.includes(value)) {
    return value;
  }

  throw new Error("INVALID_SUBSCRIPTION_DURATION");
}

function toDate(value, errorCode) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(errorCode);
  }

  return date;
}

function addSubscriptionPeriod(from, duration) {
  const parsedDuration = parseSubscriptionDuration(duration);
  const result = toDate(from, "INVALID_SUBSCRIPTION_PERIOD_START");
  const sourceDay = result.getUTCDate();
  const targetMonthIndex = result.getUTCMonth() +
    (parsedDuration === YEARLY_SUBSCRIPTION_DURATION ? 12 : 1);
  const targetYear = result.getUTCFullYear() + Math.floor(targetMonthIndex / 12);
  const targetMonth = targetMonthIndex % 12;
  const lastTargetDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();

  result.setUTCDate(1);
  result.setUTCFullYear(targetYear);
  result.setUTCMonth(targetMonth);
  result.setUTCDate(Math.min(sourceDay, lastTargetDay));

  return result;
}

function resolveSubscriptionPeriod({ paymentAt, currentExpiresAt, duration }) {
  const paidAt = toDate(paymentAt, "INVALID_SUBSCRIPTION_PAYMENT_DATE");
  const currentExpiration = currentExpiresAt == null
    ? null
    : toDate(currentExpiresAt, "INVALID_SUBSCRIPTION_EXPIRATION_DATE");
  const startsAt = currentExpiration && currentExpiration > paidAt
    ? currentExpiration
    : paidAt;

  return {
    startsAt: new Date(startsAt.getTime()),
    endsAt: addSubscriptionPeriod(startsAt, duration),
  };
}

module.exports = {
  FAVOR_SUBSCRIPTION_DURATION,
  MONTHLY_SUBSCRIPTION_DURATION,
  SUBSCRIPTION_DURATIONS,
  YEARLY_SUBSCRIPTION_DURATION,
  addSubscriptionPeriod,
  parseSubscriptionDuration,
  resolveSubscriptionPeriod,
};
