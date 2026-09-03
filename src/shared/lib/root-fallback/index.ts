"use client";

import { useSyncExternalStore } from "react";

import englishCopy from "../../locales/root-fallback.en.json";
import russianCopy from "../../locales/root-fallback.ru.json";

const subscribeToLocale = () => () => undefined;

const getClientLocale = (): "en" | "ru" => {
  const pathLocale = window.location.pathname.split("/")[1];

  if (pathLocale === "en" || pathLocale === "ru") {
    return pathLocale;
  }

  return document.documentElement.lang === "en" ? "en" : "ru";
};

export const useRootFallbackCopy = () => {
  const locale = useSyncExternalStore(
    subscribeToLocale,
    getClientLocale,
    () => "en" as const,
  );

  return {
    locale,
    copy: locale === "en" ? englishCopy : russianCopy,
  };
};
