"use client";

import { Clock3, X } from "lucide-react";
import { useRef } from "react";
import { useTranslations } from "next-intl";

import { liquidGlassMenuClassName } from "@/shared/ui";

type Props = {
  id: string;
  items: string[];
  onSelect: (query: string) => void;
  onRemove: (query: string) => void;
  onClear: () => void;
  onClose: () => void;
};

export function SearchHistoryMenu({
  id,
  items,
  onSelect,
  onRemove,
  onClear,
  onClose,
}: Props) {
  const t = useTranslations("SearchFilter");
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const focusSearchInput = (button: HTMLButtonElement) => {
    const searchInput = button
      .closest<HTMLElement>("[data-search-area]")
      ?.querySelector<HTMLInputElement>("input");
    searchInput?.focus();
  };

  if (items.length === 0) {
    return null;
  }

  return (
    <div
      id={id}
      role="dialog"
      className={`absolute inset-x-0 top-full z-30 mt-2 ${liquidGlassMenuClassName}`}
      aria-label={t("RecentSearches")}
    >
      <div className="flex items-center justify-between gap-3 border-b border-[var(--liquid-glass-border)] px-3 py-2.5">
        <span className="text-xs font-semibold text-[var(--muted-foreground)]">
          {t("RecentSearches")}
        </span>
        <button
          type="button"
          onClick={(event) => {
            focusSearchInput(event.currentTarget);
            onClear();
          }}
          className="rounded-lg px-2 py-1 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-black/5 hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--liquid-glass-border)] dark:hover:bg-white/10"
        >
          {t("ClearSearchHistory")}
        </button>
      </div>

      <div className="max-h-64 overflow-y-auto p-1.5">
        {items.map((query, index) => (
          <div key={query.toLocaleLowerCase()} className="group flex items-center gap-1">
            <button
              data-search-history-item
              ref={(node) => {
                itemRefs.current[index] = node;
              }}
              type="button"
              onClick={(event) => {
                focusSearchInput(event.currentTarget);
                onSelect(query);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  itemRefs.current[(index + 1) % items.length]?.focus();
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  if (index === 0) {
                    focusSearchInput(event.currentTarget);
                  } else {
                    itemRefs.current[index - 1]?.focus();
                  }
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  focusSearchInput(event.currentTarget);
                  onClose();
                }
              }}
              className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm text-[var(--foreground)] transition-colors hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--liquid-glass-border)] dark:hover:bg-white/10"
            >
              <Clock3 className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
              <span className="truncate">{query}</span>
            </button>
            <button
              type="button"
              onClick={(event) => {
                focusSearchInput(event.currentTarget);
                onRemove(query);
              }}
              aria-label={t("RemoveSearchHistoryItem", { query })}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[var(--muted-foreground)] transition-colors hover:bg-black/5 hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--liquid-glass-border)] dark:hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
