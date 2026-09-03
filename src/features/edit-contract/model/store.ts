"use client";

import { createStore, type StateCreator, useStore } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
  applyTelegramPreviewToForm,
  buildPreviewFromContract,
  mapContractToFormState,
  reconcileContractMediaRefs,
  setPrimaryContractMediaRef,
  toggleContractMediaRef,
  type ContractDto,
  type ContractFormState,
  type TelegramPostPreviewDto,
} from "@/entities/contract";
import {
  buildContractFormDraftStorageKey,
  createGuardedContractDraftStorage,
} from "@/entities/contract";
import { createStorageHealthStore } from "@/shared/lib/storage";
import {
  mergeEditContractDraftWithLatest,
  parseRestorableEditContractDraft,
  selectPersistedEditContractDraft,
} from "./draft-persistence";

type EditContractDraftStore = {
  form: ContractFormState;
  preview: TelegramPostPreviewDto | null;
  baseForm: ContractFormState;
  basePreview: TelegramPostPreviewDto | null;
  baseContractUpdatedAt: string;
  isDirty: boolean;
  wasRestored: boolean;
  hasRevisionConflict: boolean;
  updateField: <T extends keyof ContractFormState>(
    field: T,
    value: ContractFormState[T],
  ) => void;
  applyPreview: (preview: TelegramPostPreviewDto) => void;
  setPreview: (preview: TelegramPostPreviewDto | null) => void;
  toggleImage: (imageUrl: string) => void;
  setPrimaryImage: (imageUrl: string) => void;
  acceptLatestRevision: () => void;
  discardDraft: () => void;
  clearDraft: () => void;
};

const createDraftState = (
  contract: ContractDto,
  clearPersistedDraft: () => void,
  allowExplicitWrites: () => void,
): StateCreator<EditContractDraftStore> =>
  (set) => ({
    form: mapContractToFormState(contract),
    preview: buildPreviewFromContract(contract),
    baseForm: mapContractToFormState(contract),
    basePreview: buildPreviewFromContract(contract),
    baseContractUpdatedAt: contract.updatedAt,
    isDirty: false,
    wasRestored: false,
    hasRevisionConflict: false,
    updateField: (field, value) => {
      allowExplicitWrites();
      set((state) => ({
        form: {
          ...state.form,
          [field]: value,
          ...(field === "isEscrow" && value === false
            ? { escrowCurrency: "TON" as const }
            : {}),
          ...(field === "type"
            ? {
                maxOpenDeals:
                  value === "order" ? "1" : state.form.maxOpenDeals || "3",
              }
            : {}),
        },
        isDirty: true,
      }));
    },
    applyPreview: (preview) => {
      allowExplicitWrites();
      set((state) => ({
        preview,
        form: {
          ...applyTelegramPreviewToForm(state.form, preview),
          mediaRefs: reconcileContractMediaRefs(
            state.form.mediaRefs,
            state.preview?.images ?? null,
            preview.images,
          ),
        },
        isDirty: true,
      }));
    },
    setPreview: (preview) => {
      allowExplicitWrites();
      set({ preview, isDirty: true });
    },
    toggleImage: (imageUrl) => {
      allowExplicitWrites();
      set((state) => ({
        form: {
          ...state.form,
          mediaRefs: toggleContractMediaRef(state.form.mediaRefs, imageUrl),
        },
        isDirty: true,
      }));
    },
    setPrimaryImage: (imageUrl) => {
      allowExplicitWrites();
      set((state) => ({
        form: {
          ...state.form,
          mediaRefs: setPrimaryContractMediaRef(
            state.form.mediaRefs,
            imageUrl,
          ),
        },
        isDirty: true,
      }));
    },
    acceptLatestRevision: () => {
      allowExplicitWrites();
      set({
        baseForm: mapContractToFormState(contract),
        basePreview: buildPreviewFromContract(contract),
        baseContractUpdatedAt: contract.updatedAt,
        hasRevisionConflict: false,
      });
    },
    discardDraft: () => {
      allowExplicitWrites();
      set({
        form: mapContractToFormState(contract),
        preview: buildPreviewFromContract(contract),
        baseForm: mapContractToFormState(contract),
        basePreview: buildPreviewFromContract(contract),
        baseContractUpdatedAt: contract.updatedAt,
        isDirty: false,
        wasRestored: false,
        hasRevisionConflict: false,
      });
      clearPersistedDraft();
    },
    clearDraft: () => {
      allowExplicitWrites();
      set({
        form: mapContractToFormState(contract),
        preview: buildPreviewFromContract(contract),
        baseForm: mapContractToFormState(contract),
        basePreview: buildPreviewFromContract(contract),
        baseContractUpdatedAt: contract.updatedAt,
        isDirty: false,
        wasRestored: false,
        hasRevisionConflict: false,
      });
      clearPersistedDraft();
    },
  });

type DraftHydrationState = {
  hasHydrated: boolean;
};

const createEditDraftStore = (ownerId: number, contract: ContractDto) => {
  const storageKey = buildContractFormDraftStorageKey({
    kind: "edit",
    ownerId,
    contractId: contract.id,
  });
  const healthStore = createStorageHealthStore();
  const hydrationStore = createStore<DraftHydrationState>()(() => ({
    hasHydrated: false,
  }));
  const guardedStorage = createGuardedContractDraftStorage(
    () => {
      if (typeof window === "undefined") return null;
      return window.localStorage;
    },
    () => healthStore.getState().reportError(),
  );
  const clearPersistedDraft = () => {
    guardedStorage.allowExplicitWrites();
    guardedStorage.removeItem(storageKey);
  };

  const draftStore = createStore<EditContractDraftStore>()(
    persist(
      createDraftState(
        contract,
        clearPersistedDraft,
        guardedStorage.allowExplicitWrites,
      ),
      {
        name: storageKey,
        version: 1,
        storage: createJSONStorage(() => guardedStorage),
        partialize: selectPersistedEditContractDraft,
        merge: (persistedState, currentState) => {
          const restored = parseRestorableEditContractDraft(persistedState);

          if (!restored) {
            return currentState;
          }

          const merged = mergeEditContractDraftWithLatest(
            restored,
            mapContractToFormState(contract),
            buildPreviewFromContract(contract),
            contract.updatedAt,
          );

          return {
            ...currentState,
            ...merged,
            wasRestored: true,
          };
        },
        onRehydrateStorage: () => (_rehydratedState, error) => {
          if (error) {
            healthStore.getState().reportError();
          }
          hydrationStore.setState({ hasHydrated: true });
        },
      },
    ),
  );

  return { draftStore, healthStore, hydrationStore };
};

const editDraftStores = new Map<
  string,
  ReturnType<typeof createEditDraftStore>
>();

const getEditDraftStore = (ownerId: number, contract: ContractDto) => {
  const cacheKey = `${ownerId}:${contract.id}:${contract.updatedAt}`;
  const existingStore = editDraftStores.get(cacheKey);

  if (existingStore) {
    return existingStore;
  }

  const store = createEditDraftStore(ownerId, contract);
  editDraftStores.set(cacheKey, store);
  return store;
};

export const useEditContractDraftStore = (
  ownerId: number,
  contract: ContractDto,
) => {
  const stores = getEditDraftStore(ownerId, contract);
  const draftState = useStore(stores.draftStore);
  const persistenceError = useStore(
    stores.healthStore,
    (state) => state.hasError,
  );
  const hasHydrated = useStore(
    stores.hydrationStore,
    (state) => state.hasHydrated,
  );

  return { ...draftState, hasHydrated, persistenceError };
};

export const clearEditContractDraft = (
  ownerId: number,
  contractId: number,
) => {
  const cachePrefix = `${ownerId}:${contractId}:`;

  for (const [cacheKey, stores] of editDraftStores) {
    if (!cacheKey.startsWith(cachePrefix)) continue;
    stores.draftStore.getState().clearDraft();
    editDraftStores.delete(cacheKey);
  }

  try {
    window.localStorage.removeItem(
      buildContractFormDraftStorageKey({
        kind: "edit",
        ownerId,
        contractId,
      }),
    );
  } catch {
    return;
  }
};
