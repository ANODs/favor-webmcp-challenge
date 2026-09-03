"use client";

import { SlidersHorizontal } from "lucide-react";
import {
  type KeyboardEventHandler,
  type ReactNode,
  useState,
} from "react";

import { liquidGlassFieldClassName, liquidGlassClassName } from "./liquid-glass";

type Props = {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  searchMaxLength?: number;
  isDisabled?: boolean;
  isFiltersOpen: boolean;
  onFiltersOpenToggle: () => void;
  filtersToggleLabel: string;
  collapsedCategoriesSlot?: ReactNode;
  searchSuggestionsSlot?: ReactNode;
  searchSuggestionsId?: string;
  isSearchSuggestionsOpen?: boolean;
  onSearchAreaFocusChange?: (isFocused: boolean) => void;
  onSearchLeave?: () => void;
  onSearchKeyDown?: KeyboardEventHandler<HTMLInputElement>;
  children?: ReactNode;
};

export function ExpandableSearch({
  searchValue,
  onSearchChange,
  searchPlaceholder,
  searchMaxLength,
  isDisabled = false,
  isFiltersOpen,
  onFiltersOpenToggle,
  filtersToggleLabel,
  collapsedCategoriesSlot,
  searchSuggestionsSlot,
  searchSuggestionsId,
  isSearchSuggestionsOpen = false,
  onSearchAreaFocusChange,
  onSearchLeave,
  onSearchKeyDown,
  children,
}: Props) {
  const [isFullyOpen, setIsFullyOpen] = useState(isFiltersOpen);
  const [prevFiltersOpen, setPrevFiltersOpen] = useState(isFiltersOpen);

  if (prevFiltersOpen !== isFiltersOpen) {
    setPrevFiltersOpen(isFiltersOpen);
    if (!isFiltersOpen) {
      setIsFullyOpen(false);
    }
  }

  return (
    <div
      aria-busy={isDisabled}
      inert={isDisabled}
      className={`flex flex-col gap-0 relative z-10 transition-opacity ${
        isDisabled ? "opacity-60" : ""
      }`}
    >
      <div className="flex gap-2">
        <div
          data-search-area
          className="relative min-w-0 flex-1"
          onFocusCapture={() => onSearchAreaFocusChange?.(true)}
          onBlurCapture={(event) => {
            const nextFocusedNode = event.relatedTarget as Node | null;
            if (!event.currentTarget.contains(nextFocusedNode)) {
              onSearchAreaFocusChange?.(false);
            }
          }}
        >
          <input
            value={searchValue}
            maxLength={searchMaxLength}
            disabled={isDisabled}
            role={searchSuggestionsId ? "combobox" : "searchbox"}
            aria-label={searchPlaceholder}
            aria-haspopup={searchSuggestionsId ? "dialog" : undefined}
            aria-expanded={
              searchSuggestionsId ? isSearchSuggestionsOpen : undefined
            }
            aria-controls={
              isSearchSuggestionsOpen ? searchSuggestionsId : undefined
            }
            onChange={(event) => onSearchChange(event.target.value)}
            onBlur={(event) => {
              const nextFocusedNode = event.relatedTarget as Node | null;
              if (!event.currentTarget.parentElement?.contains(nextFocusedNode)) {
                onSearchLeave?.();
              }
            }}
            onKeyDown={onSearchKeyDown}
            placeholder={searchPlaceholder}
            className={liquidGlassFieldClassName}
          />
          {searchSuggestionsSlot}
        </div>
        {children && (
          <button
            type="button"
            disabled={isDisabled}
            onClick={onFiltersOpenToggle}
            aria-label={filtersToggleLabel}
            aria-expanded={isFiltersOpen}
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-colors disabled:cursor-wait ${liquidGlassClassName} ${
              isFiltersOpen ? "bg-black/5 dark:bg-white/10" : ""
            } text-zinc-900 dark:text-zinc-100`}
          >
            <SlidersHorizontal className="h-5 w-5" />
          </button>
        )}
      </div>

      {collapsedCategoriesSlot && (
        <div
          className={`grid transition-[grid-template-rows,opacity,margin] duration-300 ease-in-out ${
            !isFiltersOpen
              ? "grid-rows-[1fr] opacity-100 mt-2"
              : "grid-rows-[0fr] opacity-0 mt-0 pointer-events-none"
          }`}
        >
          <div className="overflow-hidden">
            <div className="overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden py-0.5">
              {collapsedCategoriesSlot}
            </div>
          </div>
        </div>
      )}

      {children && (
        <div
          className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
            isFiltersOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          }`}
          onTransitionEnd={(e) => {
            if (e.target === e.currentTarget && isFiltersOpen) {
              setIsFullyOpen(true);
            }
          }}
        >
          <div className={isFullyOpen ? "overflow-visible" : "overflow-hidden"}>
            <div
              className={`pb-1 pt-3 transition-transform duration-300 ease-in-out ${
                isFiltersOpen ? "translate-y-0" : "-translate-y-4"
              }`}
            >
              {children}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
