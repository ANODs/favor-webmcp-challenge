import { createStore } from "zustand/vanilla";

type StorageResolver = () => Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
> | null;

export type SafeBrowserStorage = {
  getItem: (name: string) => string | null;
  setItem: (name: string, value: string) => void;
  removeItem: (name: string) => void;
};

export const createSafeBrowserStorage = (
  resolveStorage: StorageResolver,
  onError: (error: unknown) => void,
): SafeBrowserStorage => ({
  getItem: (name) => {
    try {
      return resolveStorage()?.getItem(name) ?? null;
    } catch (error) {
      onError(error);
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      resolveStorage()?.setItem(name, value);
    } catch (error) {
      onError(error);
    }
  },
  removeItem: (name) => {
    try {
      resolveStorage()?.removeItem(name);
    } catch (error) {
      onError(error);
    }
  },
});

type StorageHealthState = {
  hasError: boolean;
  reportError: () => void;
};

export const createStorageHealthStore = () =>
  createStore<StorageHealthState>()((set) => ({
    hasError: false,
    reportError: () => set({ hasError: true }),
  }));
