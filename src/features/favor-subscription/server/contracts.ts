import { z } from "zod";

import {
  FAVOR_SUBSCRIPTION_DURATION,
  SUBSCRIPTION_DURATIONS,
  parseSubscriptionDuration,
  type SubscriptionDuration,
} from "@/entities/subscription";

const checkoutAttemptIdSchema = z.string().uuid();
const recipientUserIdSchema = z.number().int().positive().optional();
const expectedAmountNanoSchema = z.string().regex(/^[1-9]\d{0,29}$/);

export const invoiceCheckoutSchema = z.object({
  duration: z.enum(SUBSCRIPTION_DURATIONS),
  locale: z.enum(["ru", "en"]),
  recipientUserId: recipientUserIdSchema,
  checkoutAttemptId: checkoutAttemptIdSchema,
}).strict();

export const tonCheckoutSchema = z.object({
  duration: z.enum(SUBSCRIPTION_DURATIONS),
  expectedAmountNano: expectedAmountNanoSchema,
  userWalletAddress: z.string().trim().min(1),
  recipientUserId: recipientUserIdSchema,
  checkoutAttemptId: checkoutAttemptIdSchema,
}).strict();

export const favorCheckoutSchema = z.object({
  duration: z.literal(FAVOR_SUBSCRIPTION_DURATION),
  expectedAmountNano: expectedAmountNanoSchema,
  userWalletAddress: z.string().trim().min(1),
  recipientUserId: recipientUserIdSchema,
  checkoutAttemptId: checkoutAttemptIdSchema,
}).strict();

export const tonConfirmationSchema = z.object({
  paymentIntentId: z.string().min(1),
  boc: z.string().min(1),
  reference: z.string().min(1),
}).strict();

export const favorConfirmationSchema = z.object({
  paymentIntentId: z.string().min(1),
  boc: z.string().min(1),
}).strict();

export type SubscriptionIntentMetadata = {
  duration: SubscriptionDuration;
  invoiceLink?: string;
};

export const parseSubscriptionIntentMetadata = (
  metadata: unknown,
): SubscriptionIntentMetadata => {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    throw new Error("INVALID_SUBSCRIPTION_INTENT_METADATA");
  }

  const record = metadata as Record<string, unknown>;
  const duration = parseSubscriptionDuration(record.duration);

  if (record.invoiceLink !== undefined && typeof record.invoiceLink !== "string") {
    throw new Error("INVALID_SUBSCRIPTION_INTENT_METADATA");
  }

  return {
    duration,
    ...(typeof record.invoiceLink === "string" ? { invoiceLink: record.invoiceLink } : {}),
  };
};
