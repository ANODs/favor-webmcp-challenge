import { z } from "zod";

import {
  contractFormStateSchema,
  telegramPostPreviewSchema,
} from "@/entities/contract";
import { resolveCategoryId } from "@/entities/category";

export const contractPublicationDraftDataSchema = z
  .object({
    version: z.literal(1),
    form: contractFormStateSchema,
    preview: telegramPostPreviewSchema.nullable(),
    wizard: z.object({
      activeLanguage: z.enum(["ru", "en"]),
      isSourceSkipped: z.boolean(),
      addTelegramPostButton: z.boolean().default(false),
    }),
    locale: z.enum(["ru", "en"]),
  })
  .transform((draft) => ({
    ...draft,
    form: {
      ...draft.form,
      category: resolveCategoryId(draft.form.category) ?? "",
    },
  }));

export type ContractPublicationDraftData = z.infer<
  typeof contractPublicationDraftDataSchema
>;

export type PreparedContractPublicationDraftDto = {
  telegramUrl: string;
  expiresAt: string;
};

export type ClaimedContractPublicationDraftDto =
  | {
      status: "claimed";
      data: ContractPublicationDraftData;
    }
  | {
      status: "published";
      contractSlug: string;
    };
