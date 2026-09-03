import { z } from "zod";

import type { TelegramPostPreviewDto } from "../api/dto";
import type { ContractFormState } from "./form";

type ContractDraftStorage = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
>;

type ContractDraftStorageResolver = () => ContractDraftStorage | null;

export type GuardedContractDraftStorage = ContractDraftStorage & {
  allowExplicitWrites: () => void;
  didInitialReadFail: () => boolean;
};

export const createGuardedContractDraftStorage = (
  resolveStorage: ContractDraftStorageResolver,
  onError: (error: unknown) => void,
): GuardedContractDraftStorage => {
  let initialReadCompleted = false;
  let initialReadFailed = false;
  let explicitWritesAllowed = false;

  const canWrite = () =>
    (initialReadCompleted && !initialReadFailed) || explicitWritesAllowed;

  return {
    getItem: (name) => {
      try {
        const storage = resolveStorage();
        if (!storage) return null;

        const value = storage.getItem(name);
        initialReadCompleted = true;
        initialReadFailed = false;
        return value;
      } catch (error) {
        initialReadCompleted = true;
        initialReadFailed = true;
        onError(error);
        return null;
      }
    },
    setItem: (name, value) => {
      if (!canWrite()) return;

      try {
        resolveStorage()?.setItem(name, value);
      } catch (error) {
        onError(error);
      }
    },
    removeItem: (name) => {
      if (!canWrite()) return;

      try {
        resolveStorage()?.removeItem(name);
      } catch (error) {
        onError(error);
      }
    },
    allowExplicitWrites: () => {
      explicitWritesAllowed = true;
    },
    didInitialReadFail: () => initialReadFailed,
  };
};

export const contractFormStateSchema: z.ZodType<ContractFormState> = z
  .object({
    titleRu: z.string().max(120),
    titleEn: z.string().max(120),
    descriptionRu: z.string().max(5000),
    descriptionEn: z.string().max(5000),
    type: z.enum(["offer", "order"]),
    category: z.string().max(80),
    tagsInput: z.string().max(500),
    basePrice: z.string().max(32),
    deadlineDays: z.string().max(8),
    maxOpenDeals: z.string().max(8),
    telegramPostUrl: z.string().max(2048),
    telegramChannelUrl: z.string().max(2048),
    cachedTelegramText: z.string().max(5000),
    mediaRefs: z.array(z.string().max(4096)).max(20),
    isScouting: z.boolean(),
    scoutedTelegramUsername: z.string().max(64),
    isEscrow: z.boolean(),
    escrowCurrency: z.enum(["TON", "USDT"]),
  })
  .strict();

export const telegramPostPreviewSchema: z.ZodType<TelegramPostPreviewDto> = z
  .object({
    telegramPostUrl: z.string().url().max(2048),
    telegramChannelUrl: z.string().url().max(2048),
    description: z.string().max(5000),
    images: z.array(z.string().max(4096)).max(20),
    translation: z
      .object({
        titleRu: z.string().max(120),
        titleEn: z.string().max(120),
        descriptionRu: z.string().max(5000),
        descriptionEn: z.string().max(5000),
      })
      .strict()
      .nullable()
      .optional(),
  })
  .strict();

export const contractFormDraftSnapshotSchema = z
  .object({
    form: contractFormStateSchema,
    preview: telegramPostPreviewSchema.nullable(),
  })
  .strict();

export type ContractFormDraftScope =
  | {
      kind: "create";
      ownerId: number | null;
    }
  | {
      kind: "edit";
      ownerId: number;
      contractId: number;
    };

const CONTRACT_FORM_DRAFT_STORAGE_PREFIX = "favor:contract-form-draft:v1";

const normalizeStorageId = (value: number, field: string) => {
  if (field === "ownerId" && value === 0) {
    return "dev";
  }

  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${field} must be a positive safe integer.`);
  }

  return String(value);
};

export const buildContractFormDraftStorageKey = (
  scope: ContractFormDraftScope,
) => {
  if (scope.kind === "create") {
    if (scope.ownerId === null) {
      return `${CONTRACT_FORM_DRAFT_STORAGE_PREFIX}:anonymous:create`;
    }

    const ownerId = normalizeStorageId(scope.ownerId, "ownerId");
    return `${CONTRACT_FORM_DRAFT_STORAGE_PREFIX}:user:${ownerId}:create`;
  }

  const ownerId = normalizeStorageId(scope.ownerId, "ownerId");
  const contractId = normalizeStorageId(scope.contractId, "contractId");
  return `${CONTRACT_FORM_DRAFT_STORAGE_PREFIX}:user:${ownerId}:contract:${contractId}`;
};
