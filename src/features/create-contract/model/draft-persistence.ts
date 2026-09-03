import { z } from "zod";

import type {
  ContractFormState,
  TelegramPostPreviewDto,
} from "@/entities/contract";
import {
  buildContractFormDraftStorageKey,
  contractFormDraftSnapshotSchema,
} from "@/entities/contract";

export type PersistedCreateContractDraft = {
  form: ContractFormState;
  preview: TelegramPostPreviewDto | null;
  addTelegramPostButton: boolean;
};

const persistedCreateContractDraftSchema = contractFormDraftSnapshotSchema
  .extend({
    addTelegramPostButton: z.boolean(),
  })
  .strict();

const persistedCreateContractDraftEnvelopeSchema = z
  .object({
    state: persistedCreateContractDraftSchema,
    version: z.number().int(),
  })
  .passthrough();

type ContractDraftStorage = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
>;

export const selectPersistedCreateContractDraft = (
  state: PersistedCreateContractDraft,
): PersistedCreateContractDraft => ({
  form: state.form,
  preview: state.preview,
  addTelegramPostButton: state.addTelegramPostButton,
});

export const parsePersistedCreateContractDraft = (
  persistedState: unknown,
): PersistedCreateContractDraft | null => {
  const parsed = persistedCreateContractDraftSchema.safeParse(persistedState);
  return parsed.success ? parsed.data : null;
};

export type AnonymousDraftClaimResult =
  | "migrated"
  | "no_source"
  | "invalid_source"
  | "destination_replaced"
  | "failed";

const findAvailableClaimBackupKey = (
  storage: ContractDraftStorage,
  destinationKey: string,
) => {
  for (let index = 1; index <= 100; index += 1) {
    const candidate = `${destinationKey}:claim-backup:${index}`;
    if (storage.getItem(candidate) === null) {
      return candidate;
    }
  }

  return null;
};

const parseCreateContractDraftEnvelope = (raw: string) => {
  let value: unknown;

  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }

  const parsed = persistedCreateContractDraftEnvelopeSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

const serializeCreateContractDraftEnvelope = (
  state: PersistedCreateContractDraft,
) =>
  JSON.stringify({
    state: selectPersistedCreateContractDraft(state),
    version: 1,
  });

export const claimAnonymousCreateContractDraft = (
  storage: ContractDraftStorage,
  ownerId: number,
): AnonymousDraftClaimResult => {
  const sourceKey = buildContractFormDraftStorageKey({
    kind: "create",
    ownerId: null,
  });
  const destinationKey = buildContractFormDraftStorageKey({
    kind: "create",
    ownerId,
  });

  try {
    const sourceRaw = storage.getItem(sourceKey);
    if (!sourceRaw) {
      return "no_source";
    }

    const source = parseCreateContractDraftEnvelope(sourceRaw);
    if (!source) {
      return "invalid_source";
    }

    const claimedRaw = serializeCreateContractDraftEnvelope(source.state);
    const destinationRaw = storage.getItem(destinationKey);

    if (destinationRaw === claimedRaw) {
      storage.removeItem(sourceKey);
      return "migrated";
    }

    let claimResult: AnonymousDraftClaimResult = "migrated";

    if (destinationRaw !== null) {
      const backupKey = findAvailableClaimBackupKey(storage, destinationKey);
      if (!backupKey) {
        return "failed";
      }

      storage.setItem(backupKey, destinationRaw);
      if (storage.getItem(backupKey) !== destinationRaw) {
        return "failed";
      }
      claimResult = "destination_replaced";
    }

    storage.setItem(destinationKey, claimedRaw);
    if (storage.getItem(destinationKey) !== claimedRaw) {
      return "failed";
    }

    storage.removeItem(sourceKey);
    return claimResult;
  } catch {
    return "failed";
  }
};

export type RestoreCreateContractDraftBackupResult =
  | "restored"
  | "not_found"
  | "invalid_backup"
  | "failed";

/**
 * Claim conflicts retain the previous account draft under an account-scoped
 * backup key. Backups are never auto-loaded; this helper restores a chosen
 * copy while first preserving the currently active account draft as another
 * backup.
 */
export const restoreCreateContractDraftClaimBackup = (
  storage: ContractDraftStorage,
  ownerId: number,
  backupIndex: number,
): RestoreCreateContractDraftBackupResult => {
  if (!Number.isSafeInteger(backupIndex) || backupIndex < 1 || backupIndex > 100) {
    return "not_found";
  }

  const destinationKey = buildContractFormDraftStorageKey({
    kind: "create",
    ownerId,
  });
  const backupKey = `${destinationKey}:claim-backup:${backupIndex}`;

  try {
    const backupRaw = storage.getItem(backupKey);
    if (!backupRaw) return "not_found";

    const backup = parseCreateContractDraftEnvelope(backupRaw);
    if (!backup) return "invalid_backup";

    const restoredRaw = serializeCreateContractDraftEnvelope(backup.state);
    const currentRaw = storage.getItem(destinationKey);

    if (currentRaw === restoredRaw) {
      return "restored";
    }

    if (currentRaw !== null) {
      const currentBackupKey = findAvailableClaimBackupKey(
        storage,
        destinationKey,
      );
      if (!currentBackupKey) return "failed";

      storage.setItem(currentBackupKey, currentRaw);
      if (storage.getItem(currentBackupKey) !== currentRaw) {
        return "failed";
      }
    }

    storage.setItem(destinationKey, restoredRaw);
    return storage.getItem(destinationKey) === restoredRaw
      ? "restored"
      : "failed";
  } catch {
    return "failed";
  }
};
