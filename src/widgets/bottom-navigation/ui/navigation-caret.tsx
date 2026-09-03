"use client";

import { NAV_ITEM_WIDTH, NAV_ITEM_HEIGHT, NAV_MOBILE_GAP, NAV_DESKTOP_GAP, NAV_CARET_WIDTH, NAV_CARET_HEIGHT } from "../config/constants";

type Props = {
  activeIndex: number;
  isDesktop: boolean;
};

export function NavigationCaret({
  activeIndex,
  isDesktop,
}: Props) {
  const itemHeight = isDesktop ? NAV_ITEM_WIDTH : NAV_ITEM_HEIGHT;
  const caretWidth = NAV_CARET_WIDTH;
  const caretHeight = isDesktop ? NAV_CARET_WIDTH : NAV_CARET_HEIGHT;

  const offsetX = (caretWidth - NAV_ITEM_WIDTH) / 2;
  const offsetY = (caretHeight - itemHeight) / 2;

  return (
    <span
      aria-hidden="true"
      className="absolute rounded-full border border-black/5 bg-black/5 transition-transform duration-300 ease-out dark:border-white/10 dark:bg-white/10"
      style={{
        width: caretWidth,
        height: caretHeight,
        left: -offsetX,
        top: -offsetY,
        transform: isDesktop
          ? `translateY(${activeIndex * (itemHeight + NAV_DESKTOP_GAP)}px)`
          : `translateX(${activeIndex * (NAV_ITEM_WIDTH + NAV_MOBILE_GAP)}px)`,
      }}
    />
  );
}
