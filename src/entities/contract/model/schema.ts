import { ContractType, EscrowCurrency } from "@prisma/client";
import { z } from "zod";

import {
  CONTRACT_PRICE_MAX_USD,
  CONTRACT_PRICE_STEP_USD,
} from "@/shared/config/contract";

export const supportedEscrowCurrencySchema = z.enum([
  EscrowCurrency.TON,
  EscrowCurrency.USDT,
]);

const scoutedTelegramUsernameSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    return value.trim().replace(/^@/, "").toLowerCase() || null;
  },
  z
    .string()
    .regex(
      /^[a-z][a-z0-9_]{4,31}$/,
      "Enter a Telegram username without a link, for example @username.",
    )
    .nullable()
    .optional(),
);

const contractBaseSchema = z.object({
  titleRu: z.string().min(5).max(120).optional().nullable(),
  titleEn: z.string().min(5).max(120).optional().nullable(),
  descriptionRu: z.string().min(20).max(5000).optional().nullable(),
  descriptionEn: z.string().min(20).max(5000).optional().nullable(),
  type: z.nativeEnum(ContractType),
  category: z.string().min(2).max(80).optional().nullable(),
  tags: z.array(z.string().min(1).max(30)).max(10).default([]),
  basePrice: z.coerce
    .number()
    .nonnegative()
    .max(CONTRACT_PRICE_MAX_USD)
    .multipleOf(CONTRACT_PRICE_STEP_USD)
    .optional()
    .nullable(),
  deadlineDays: z.coerce.number().int().positive().max(365).optional().nullable(),
  maxOpenDeals: z.coerce.number().int().positive().max(20).optional().nullable(),
  telegramPostUrl: z.string().url().optional().nullable(),
  telegramChannelUrl: z.string().url().optional().nullable(),
  cachedTelegramText: z.string().max(5000).optional().nullable(),
  mediaRefs: z.array(z.string()).optional().nullable(),
  isScouting: z.boolean().optional(),
  scoutedTelegramUsername: scoutedTelegramUsernameSchema,
  isEscrow: z.boolean().optional(),
  escrowCurrency: supportedEscrowCurrencySchema.optional(),
});

export const contractInputSchema = contractBaseSchema.refine(data => (data.titleRu && data.descriptionRu) || (data.titleEn && data.descriptionEn), {
  message: "Enter a title and description in at least one language.",
  path: ["titleRu"]
});

export const contractUpdateSchema = contractBaseSchema
  .omit({ scoutedTelegramUsername: true })
  .partial()
  .extend({
    contractId: z.number().int().positive(),
    baseUpdatedAt: z.string().datetime({ offset: true }),
  });
