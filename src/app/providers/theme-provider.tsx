"use client";

import { useEffect } from "react";

import { useThemeStore } from "@/shared/store/theme-store";

type Props = {
  children: React.ReactNode;
};

const getSystemTheme = () =>
  window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

export function ThemeProvider({ children }: Props) {
  const theme = useThemeStore((state) => state.theme);
  const hasHydrated = useThemeStore((state) => state.hasHydrated);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const applyTheme = () => {
      const resolvedTheme = theme === "system" ? getSystemTheme() : theme;
      const root = document.documentElement;

      root.dataset.theme = resolvedTheme;
      root.style.colorScheme = resolvedTheme;
    };

    applyTheme();
    mediaQuery.addEventListener("change", applyTheme);

    return () => {
      mediaQuery.removeEventListener("change", applyTheme);
    };
  }, [theme, hasHydrated]);

  return children;
}
