import { z } from "zod";

import { dealBriefResourcesSchema } from "@/entities/deal";

export const initiateContractDealSchema = z
  .object({
    details: z.string().trim().min(5).max(3000),
    price: z.coerce.number().nonnegative(),
    deadlineDays: z.coerce.number().int().positive().max(365),
    isEscrow: z.boolean().optional(),
    briefResources: dealBriefResourcesSchema.default([]),
  })
  .strict();

export type InitiateContractDealPayload = z.input<
  typeof initiateContractDealSchema
>;
