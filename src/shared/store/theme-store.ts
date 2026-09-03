"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { storageKeys } from "@/shared/constants/storage-keys";

export type ThemePreference = "light" | "dark" | "system";

type ThemeState = {
  theme: ThemePreference;
  hasHydrated: boolean;
  setTheme: (theme: ThemePreference) => void;
  setHasHydrated: (value: boolean) => void;
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: "system",
      hasHydrated: false,
      setTheme: (theme) => set({ theme }),
      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: storageKeys.themePreference,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        theme: state.theme,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
