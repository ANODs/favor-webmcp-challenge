"use client";

import { useEffect } from "react";

import { triggerTelegramImpact } from "@/shared/lib/telegram";

export function GlobalHapticFeedback() {
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      let target = e.target as Node | null;

      if (target?.nodeType === Node.TEXT_NODE) {
        target = target.parentNode;
      }

      if (!(target instanceof Element)) {
        return;
      }

      const clickable = target.closest(
        "button, a, [role='button'], [role='menuitem'], [role='tab']"
      );

      if (clickable) {
        // Skip if disabled
        if (
          clickable.hasAttribute("disabled") ||
          clickable.getAttribute("aria-disabled") === "true"
        ) {
          return;
        }

        triggerTelegramImpact("light");
      }
    };

    document.addEventListener("click", handleClick, {
      capture: true,
      passive: true,
    });

    return () => {
      document.removeEventListener("click", handleClick, { capture: true });
    };
  }, []);

  return null;
}
