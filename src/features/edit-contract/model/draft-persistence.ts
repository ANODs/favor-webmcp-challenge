import { z } from "zod";

import type {
  ContractFormState,
  TelegramPostPreviewDto,
} from "@/entities/contract";
import { contractFormDraftSnapshotSchema } from "@/entities/contract";

export type PersistedEditContractDraft = {
  form: ContractFormState;
  preview: TelegramPostPreviewDto | null;
  baseForm?: ContractFormState;
  basePreview?: TelegramPostPreviewDto | null;
  baseContractUpdatedAt: string;
  isDirty: boolean;
};

const persistedEditContractDraftSchema = contractFormDraftSnapshotSchema
  .extend({
    baseForm: contractFormDraftSnapshotSchema.shape.form.optional(),
    basePreview: contractFormDraftSnapshotSchema.shape.preview.optional(),
    baseContractUpdatedAt: z.string().min(1).max(64),
    isDirty: z.boolean(),
  })
  .strict();

export const selectPersistedEditContractDraft = (
  state: PersistedEditContractDraft,
): PersistedEditContractDraft => ({
  form: state.form,
  preview: state.preview,
  baseForm: state.baseForm,
  basePreview: state.basePreview,
  baseContractUpdatedAt: state.baseContractUpdatedAt,
  isDirty: state.isDirty,
});

export const parseRestorableEditContractDraft = (
  persistedState: unknown,
): PersistedEditContractDraft | null => {
  const parsed = persistedEditContractDraftSchema.safeParse(persistedState);

  if (!parsed.success || !parsed.data.isDirty) {
    return null;
  }

  return parsed.data;
};

const valuesAreEqual = (left: unknown, right: unknown) =>
  JSON.stringify(left) === JSON.stringify(right);

export const mergeEditContractDraftWithLatest = (
  draft: PersistedEditContractDraft,
  latestForm: ContractFormState,
  latestPreview: TelegramPostPreviewDto | null,
  latestUpdatedAt: string,
) => {
  if (draft.baseContractUpdatedAt === latestUpdatedAt) {
    return {
      ...draft,
      baseForm: draft.baseForm ?? latestForm,
      basePreview: draft.basePreview ?? latestPreview,
      hasRevisionConflict: false,
    };
  }

  if (!draft.baseForm) {
    return {
      ...draft,
      hasRevisionConflict: true,
    };
  }

  const mergedForm = { ...latestForm };
  const mergedFormRecord = mergedForm as unknown as Record<string, unknown>;
  let hasRevisionConflict = false;

  for (const field of Object.keys(latestForm) as Array<keyof ContractFormState>) {
    const baseValue = draft.baseForm[field];
    const localValue = draft.form[field];
    const latestValue = latestForm[field];

    if (valuesAreEqual(localValue, baseValue)) {
      continue;
    }

    mergedFormRecord[field] = localValue;
    if (
      !valuesAreEqual(latestValue, baseValue) &&
      !valuesAreEqual(localValue, latestValue)
    ) {
      hasRevisionConflict = true;
    }
  }

  let mergedPreview = latestPreview;
  if (!valuesAreEqual(draft.preview, draft.basePreview ?? null)) {
    mergedPreview = draft.preview;
    if (
      !valuesAreEqual(latestPreview, draft.basePreview ?? null) &&
      !valuesAreEqual(draft.preview, latestPreview)
    ) {
      hasRevisionConflict = true;
    }
  }

  if (hasRevisionConflict) {
    return {
      ...draft,
      form: mergedForm,
      preview: mergedPreview,
      hasRevisionConflict: true,
    };
  }

  return {
    ...draft,
    form: mergedForm,
    preview: mergedPreview,
    baseForm: latestForm,
    basePreview: latestPreview,
    baseContractUpdatedAt: latestUpdatedAt,
    isDirty:
      !valuesAreEqual(mergedForm, latestForm) ||
      !valuesAreEqual(mergedPreview, latestPreview),
    hasRevisionConflict: false,
  };
};
