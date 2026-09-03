"use client";

import { createStore, type StateCreator, useStore } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { resolveCategoryId } from "@/entities/category";
import {
  applyTelegramPreviewToForm,
  defaultContractFormState,
  reconcileContractMediaRefs,
  setPrimaryContractMediaRef,
  toggleContractMediaRef,
  type ContractFormState,
  type TelegramPostPreviewDto,
} from "@/entities/contract";
import {
  buildContractFormDraftStorageKey,
  createGuardedContractDraftStorage,
} from "@/entities/contract";
import { createStorageHealthStore } from "@/shared/lib/storage";
import {
  parsePersistedCreateContractDraft,
  selectPersistedCreateContractDraft,
} from "./draft-persistence";

type CreateContractDraftStore = {
  form: ContractFormState;
  preview: TelegramPostPreviewDto | null;
  addTelegramPostButton: boolean;
  updateField: <T extends keyof ContractFormState>(
    field: T,
    value: ContractFormState[T],
  ) => void;
  applyPreview: (preview: TelegramPostPreviewDto) => void;
  setPreview: (preview: TelegramPostPreviewDto | null) => void;
  replaceDraft: (
    form: ContractFormState,
    preview: TelegramPostPreviewDto | null,
    addTelegramPostButton?: boolean,
  ) => void;
  setAddTelegramPostButton: (value: boolean) => void;
  clearTelegramSource: () => void;
  toggleImage: (imageUrl: string) => void;
  setPrimaryImage: (imageUrl: string) => void;
  resetDraft: () => void;
  lastClaimedToken: string | null;
  setLastClaimedToken: (token: string | null) => void;
};

const createDraftState = (
  clearPersistedDraft: () => void,
  allowExplicitWrites: () => void,
): StateCreator<CreateContractDraftStore> =>
  (set) => ({
    form: defaultContractFormState,
    preview: null,
    addTelegramPostButton: false,
    lastClaimedToken: null,
    setLastClaimedToken: (token) => set({ lastClaimedToken: token }),
    updateField: (field, value) => {
      allowExplicitWrites();
      set((state) => ({
        form: {
          ...state.form,
          [field]: value,
          ...(field === "type"
            ? {
                maxOpenDeals:
                  value === "order" ? "1" : state.form.maxOpenDeals || "3",
              }
            : {}),
        },
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
      }));
    },
    setPreview: (preview) => {
      allowExplicitWrites();
      set({ preview });
    },
    replaceDraft: (form, preview, addTelegramPostButton = false) => {
      allowExplicitWrites();
      set({ form, preview, addTelegramPostButton });
    },
    setAddTelegramPostButton: (addTelegramPostButton) => {
      allowExplicitWrites();
      set({ addTelegramPostButton });
    },
    clearTelegramSource: () => {
      allowExplicitWrites();
      set((state) => ({
        preview: null,
        addTelegramPostButton: false,
        form: {
          ...state.form,
          telegramPostUrl: "",
          telegramChannelUrl: "",
          cachedTelegramText: "",
          mediaRefs: [],
        },
      }));
    },
    toggleImage: (imageUrl) => {
      allowExplicitWrites();
      set((state) => ({
        form: {
          ...state.form,
          mediaRefs: toggleContractMediaRef(state.form.mediaRefs, imageUrl),
        },
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
      }));
    },
    resetDraft: () => {
      allowExplicitWrites();
      set({
        form: defaultContractFormState,
        preview: null,
        addTelegramPostButton: false,
        lastClaimedToken: null,
      });
      clearPersistedDraft();
    },
  });

type DraftHydrationState = {
  hasHydrated: boolean;
};

const createOwnerDraftStore = (ownerId: number | null) => {
  const storageKey = buildContractFormDraftStorageKey({
    kind: "create",
    ownerId,
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

  const draftStore = createStore<CreateContractDraftStore>()(
    persist(
      createDraftState(
        clearPersistedDraft,
        guardedStorage.allowExplicitWrites,
      ),
      {
        name: storageKey,
        version: 1,
        storage: createJSONStorage(() => guardedStorage),
        partialize: selectPersistedCreateContractDraft,
        merge: (persistedState, currentState) => {
          const parsed = parsePersistedCreateContractDraft(persistedState);

          if (!parsed) {
            return currentState;
          }

          return {
            ...currentState,
            ...parsed,
            form: {
              ...parsed.form,
              category: resolveCategoryId(parsed.form.category) ?? "",
            },
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

const pendingOwnerStore = {
  draftStore: createStore<CreateContractDraftStore>()(
    createDraftState(
      () => undefined,
      () => undefined,
    ),
  ),
  healthStore: createStorageHealthStore(),
  hydrationStore: createStore<DraftHydrationState>()(() => ({
    hasHydrated: false,
  })),
};
const ownerStores = new Map<string, ReturnType<typeof createOwnerDraftStore>>();

const getOwnerDraftStore = (ownerId: number | null) => {
  const cacheKey = ownerId === null ? "anonymous" : `user:${ownerId}`;
  const existingStore = ownerStores.get(cacheKey);

  if (existingStore) {
    return existingStore;
  }

  const store = createOwnerDraftStore(ownerId);
  ownerStores.set(cacheKey, store);
  return store;
};

export const useCreateContractDraftStore = (
  ownerId: number | null | undefined,
) => {
  const stores =
    ownerId === undefined ? pendingOwnerStore : getOwnerDraftStore(ownerId);
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
