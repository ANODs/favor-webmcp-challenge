import { beginCell } from "@ton/ton";

import {
  MONTHLY_SUBSCRIPTION_DURATION,
  type SubscriptionDuration,
} from "@/shared/lib/subscription";

const TON_SUBSCRIPTION_REFERENCE_PREFIX = "favor-ton-premium";

export const buildTonSubscriptionReference = (
  userId: number,
  duration: SubscriptionDuration = MONTHLY_SUBSCRIPTION_DURATION,
) =>
  `${TON_SUBSCRIPTION_REFERENCE_PREFIX}:${userId}:${Date.now()}:${duration}:${crypto.randomUUID().slice(0, 8)}`;

export const isTonSubscriptionReferenceForUser = (reference: string, userId: number) =>
  reference.startsWith(`${TON_SUBSCRIPTION_REFERENCE_PREFIX}:${userId}:`);

export const buildTonSubscriptionPayload = (reference: string) =>
  beginCell().storeUint(0, 32).storeStringTail(reference).endCell().toBoc().toString("base64");
