"use client";

import { useEffect } from "react";

import { useRouter } from "@/i18n/routing";
import { routes } from "@/shared/config/routes";
import { getTelegramWebApp } from "@/shared/lib/telegram";

export function TelegramSettingsButton() {
  const router = useRouter();

  useEffect(() => {
    const settingsButton = getTelegramWebApp()?.SettingsButton;

    if (!settingsButton) {
      return;
    }

    const handleClick = () => {
      router.push(routes.settings);
    };

    settingsButton.onClick(handleClick);
    settingsButton.show();

    return () => {
      settingsButton.offClick(handleClick);
      settingsButton.hide();
    };
  }, [router]);

  return null;
}
