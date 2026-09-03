"use client";

import type { KeyboardEvent } from "react";
import { useEffect, useRef } from "react";
import { FileText, Handshake, Images, MessageCircle, Users } from "lucide-react";

export type ProfileTabId =
  | "contracts"
  | "portfolio"
  | "reviews"
  | "deals"
  | "referrals";

type ProfileTabItem = {
  id: ProfileTabId;
  label: string;
  count: number;
};

type Props = {
  activeTab: ProfileTabId;
  items: ProfileTabItem[];
  label: string;
  onChange: (tab: ProfileTabId) => void;
};

const tabIconMap = {
  contracts: FileText,
  portfolio: Images,
  reviews: MessageCircle,
  deals: Handshake,
  referrals: Users,
} satisfies Record<ProfileTabId, typeof Images>;

export const getProfileTabId = (tab: ProfileTabId) => `profile-tab-${tab}`;
export const getProfileTabPanelId = (tab: ProfileTabId) => `profile-panel-${tab}`;

export function ProfileSectionTabs({ activeTab, items, label, onChange }: Props) {
  const tabListRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeIndex = items.findIndex((item) => item.id === activeTab);

  useEffect(() => {
    const revealActiveTab = () => {
      const tabList = tabListRef.current;
      const activeElement = tabRefs.current[activeIndex];

      if (!tabList || !activeElement) {
        return;
      }

      const nextScrollLeft =
        activeElement.offsetLeft - (tabList.clientWidth - activeElement.clientWidth) / 2;

      tabList.scrollTo({ left: Math.max(0, nextScrollLeft), behavior: "smooth" });
    };

    revealActiveTab();

    const resizeObserver = new ResizeObserver(revealActiveTab);

    if (tabListRef.current) {
      resizeObserver.observe(tabListRef.current);
    }

    return () => resizeObserver.disconnect();
  }, [activeIndex]);

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;

    if (event.key === "ArrowRight") {
      nextIndex = (index + 1) % items.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (index - 1 + items.length) % items.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = items.length - 1;
    }

    if (nextIndex === null) {
      return;
    }

    event.preventDefault();
    onChange(items[nextIndex].id);
    tabRefs.current[nextIndex]?.focus();
  };

  return (
    <div
      className="theme-surface sticky top-2 z-20 overflow-hidden rounded-[1.75rem] border p-1.5 shadow-[0_12px_32px_rgba(9,9,11,0.08)]"
      aria-label={label}
    >
      <div
        ref={tabListRef}
        role="tablist"
        aria-label={label}
        className="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item, index) => {
          const Icon = tabIconMap[item.id];
          const isActive = item.id === activeTab;

          return (
            <button
              key={item.id}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              id={getProfileTabId(item.id)}
              type="button"
              role="tab"
              aria-controls={getProfileTabPanelId(item.id)}
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onChange(item.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={`group inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-[1.35rem] px-3.5 text-sm font-semibold outline-none transition duration-200 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 sm:h-14 sm:px-5 xl:min-w-0 xl:flex-1 ${
                isActive
                  ? "bg-zinc-950 text-white shadow-md shadow-zinc-950/15 dark:bg-zinc-800 dark:shadow-black/30"
                  : "text-zinc-500 hover:bg-white/70 hover:text-zinc-950 dark:hover:bg-white/5"
              }`}
            >
              <Icon
                className={`h-[18px] w-[18px] shrink-0 transition-transform duration-200 ${
                  isActive ? "scale-100" : "scale-95 group-hover:scale-100"
                }`}
                strokeWidth={isActive ? 2.25 : 2}
                aria-hidden="true"
              />
              <span>{item.label}</span>
              <span
                className={`min-w-6 rounded-full px-1.5 py-0.5 text-center text-[11px] leading-4 ${
                  isActive ? "bg-white/15 text-white" : "bg-zinc-200/80 text-zinc-600 dark:bg-white/10"
                }`}
                aria-hidden="true"
              >
                {item.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
