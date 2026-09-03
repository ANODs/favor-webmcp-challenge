import type { TelegramStoryTheme } from "../model/types";

export const resolveTelegramStoryTheme = (
  resolvedTheme: string | undefined,
  prefersDark: boolean,
): TelegramStoryTheme => {
  if (resolvedTheme === "light" || resolvedTheme === "dark") return resolvedTheme;
  return prefersDark ? "dark" : "light";
};
