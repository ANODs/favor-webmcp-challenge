"use client";

import { usePathname, useRouter } from "@/i18n/routing";
import { useCallback, useEffect, useRef } from "react";

import { routes } from "@/shared/config/routes";
import { triggerTelegramImpact } from "@/shared/lib/telegram/client";
import { useBackButtonStore } from "@/shared/lib/telegram/back-button-store";

const ROOT_PATHS = new Set([
  "/",
  routes.feed,
  routes.deals,
  routes.profile,
  routes.settings,
  routes.moderation,
]);

export function TelegramBackButton() {
  const pathname = usePathname();
  const router = useRouter();

  const stack = useBackButtonStore((state) => state.stack);

  useEffect(() => {
    const backButton = window.Telegram?.WebApp?.BackButton;

    if (!backButton) {
      return;
    }

    const hasDialog = stack.length > 0;
    const shouldShow = hasDialog || (pathname ? !ROOT_PATHS.has(pathname) : false);

    if (!shouldShow) {
      backButton.hide();
      return;
    }

    const handleClick = () => {
      triggerTelegramImpact("light");
      
      if (stack.length > 0) {
        const topHandler = stack[stack.length - 1];
        topHandler();
      } else {
        if (window.history.length <= 1 || (window.history.state && window.history.state.idx === 0)) {
          router.push(routes.feed);
        } else {
          router.back();
        }
      }
    };

    backButton.show();
    backButton.onClick(handleClick);

    return () => {
      backButton.offClick(handleClick);
      backButton.hide();
    };
  }, [pathname, router, stack]);

  return null;
}

export function useDialogBackButton(isOpen: boolean, onClose: () => void) {
  const pushHandler = useBackButtonStore((state) => state.pushHandler);
  const popHandler = useBackButtonStore((state) => state.popHandler);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const handleClose = useCallback(() => {
    onCloseRef.current();
  }, []);

  useEffect(() => {
    if (isOpen) {
      pushHandler(handleClose);
      return () => popHandler(handleClose);
    }
  }, [handleClose, isOpen, popHandler, pushHandler]);
}
