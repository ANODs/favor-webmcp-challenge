"use client";

import {
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { ArrowDown, ArrowUp, Check, RotateCcw, Search, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import {
  getCategoryItemLabel,
  resolveCategoryId,
  useCategories,
  type CategoryItem,
} from "@/entities/category";
import { SEARCH_HISTORY_QUERY_MAX_LENGTH } from "@/entities/search-history";
import {
  Button,
  ExpandableSearch,
  liquidGlassClassName,
  liquidGlassFieldClassName,
  RatingStars,
  ResponsiveSelect,
} from "@/shared/ui";
import {
  getStatusOptions,
  getTypeOptions,
  getSortOptions,
  getPeriodOptions,
  getIsEscrowOptions,
} from "../config/constants";
import type { SearchFiltersState } from "../lib/types";
import { SearchHistoryMenu } from "./search-history-menu";

type Props = {
  filters: SearchFiltersState;
  setFilters: Dispatch<SetStateAction<SearchFiltersState>>;
  isFiltersOpen: boolean;
  setIsFiltersOpen: Dispatch<SetStateAction<boolean>>;
  isModerator?: boolean;
  forDeals?: boolean;
  favoritesEnabled?: boolean;
  onFavoritesOnlyChange?: (checked: boolean) => void;
  additionalStatusOptions?: Array<{ value: string; label: string }>;
  hasActiveFilters?: boolean;
  onResetFilters?: () => void;
  searchHistory?: string[];
  onSearchCommit?: (query: string) => void;
  onSearchHistoryRemove?: (query: string) => void;
  onSearchHistoryClear?: () => void;
  isReady?: boolean;
};

const filterFieldClassName = liquidGlassFieldClassName;
const checkboxLabelClassName =
  "flex items-center gap-2 whitespace-nowrap text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] sm:text-sm [-webkit-tap-highlight-color:transparent]";
const checkboxBoxClassName =
  "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--liquid-glass-border)]";

export function SearchFilterWidget({
  filters,
  setFilters,
  isFiltersOpen,
  setIsFiltersOpen,
  isModerator = false,
  forDeals = false,
  favoritesEnabled = true,
  onFavoritesOnlyChange,
  additionalStatusOptions = [],
  hasActiveFilters = false,
  onResetFilters,
  searchHistory = [],
  onSearchCommit,
  onSearchHistoryRemove,
  onSearchHistoryClear,
  isReady = true,
}: Props) {
  const locale = useLocale();
  const t = useTranslations("SearchFilter");
  const statusOptions = [
    ...additionalStatusOptions,
    ...getStatusOptions(t, isModerator, forDeals),
  ];
  const typeOptions = getTypeOptions(t);
  const isEscrowOptions = getIsEscrowOptions(t);
  const sortOptions = getSortOptions(t);
  const periodOptions = getPeriodOptions(t);

  const categoriesQuery = useCategories();
  const categories = useMemo(() => categoriesQuery.data || [], [categoriesQuery.data]);

  const [tagSearchQuery, setTagSearchQuery] = useState("");
  const [isSearchHistoryOpen, setIsSearchHistoryOpen] = useState(false);
  const searchHistoryId = useId();
  const expandedCategoriesRef = useRef<HTMLDivElement>(null);
  const isSearchDirtyRef = useRef(false);

  const isSameSearchQuery = (left: string, right: string) =>
    left.trim().toLocaleLowerCase(locale) ===
    right.trim().toLocaleLowerCase(locale);

  const visibleSearchHistory = useMemo(() => {
    const query = filters.search.trim().toLocaleLowerCase(locale);
    if (!query) {
      return searchHistory;
    }

    return searchHistory.filter((historyItem) =>
      historyItem.toLocaleLowerCase(locale).includes(query),
    );
  }, [filters.search, locale, searchHistory]);

  const filteredCategories = useMemo(() => {
    const query = tagSearchQuery.trim().toLocaleLowerCase(locale);
    if (!query) return categories;

    return categories.filter((category) =>
      [category.labelRu, category.labelEn, category.id].some((candidate) =>
        candidate.toLocaleLowerCase(locale).includes(query),
      ),
    );
  }, [categories, locale, tagSearchQuery]);

  const handleToggleCategory = (categoryId: string) => {
    setFilters((current) => ({
      ...current,
      category: resolveCategoryId(current.category) === categoryId ? "" : categoryId,
    }));
  };

  const keepSelectedCategoryVisible = useCallback(
    (node: HTMLButtonElement | null) => {
      if (!node || !isFiltersOpen) {
        return;
      }

      const scrollContainer = expandedCategoriesRef.current;
      if (!scrollContainer) {
        return;
      }

      const containerRect = scrollContainer.getBoundingClientRect();
      const nodeRect = node.getBoundingClientRect();
      const verticalOffset =
        nodeRect.top < containerRect.top
          ? nodeRect.top - containerRect.top
          : nodeRect.bottom > containerRect.bottom
            ? nodeRect.bottom - containerRect.bottom
            : 0;
      const horizontalOffset =
        nodeRect.left < containerRect.left
          ? nodeRect.left - containerRect.left
          : nodeRect.right > containerRect.right
            ? nodeRect.right - containerRect.right
            : 0;

      if (verticalOffset === 0 && horizontalOffset === 0) {
        return;
      }

      // Scrolling the button itself into view can also move the document viewport.
      scrollContainer.scrollTo({
        top: scrollContainer.scrollTop + verticalOffset,
        left: scrollContainer.scrollLeft + horizontalOffset,
        behavior: "smooth",
      });
    },
    [isFiltersOpen],
  );

  const collapsedCategoriesSlot = (
    <DraggableCategorySlider
      categories={categories}
      selectedCategory={filters.category}
      onSelectCategory={handleToggleCategory}
    />
  );

  const handleSearchHistorySelect = (query: string) => {
    isSearchDirtyRef.current = false;
    setFilters((current) => ({ ...current, search: query }));
    onSearchCommit?.(query);
    setIsSearchHistoryOpen(false);
  };

  const handleResetFilters = () => {
    isSearchDirtyRef.current = false;
    setTagSearchQuery("");
    setIsSearchHistoryOpen(false);
    onResetFilters?.();
  };

  return (
    <ExpandableSearch
      searchValue={filters.search}
      onSearchChange={(value) => {
        isSearchDirtyRef.current = true;
        setFilters((current) => ({ ...current, search: value }));
        setIsSearchHistoryOpen(true);
      }}
      searchPlaceholder={t("SearchPlaceholder")}
      filtersToggleLabel={t("FiltersToggleLabel")}
      searchMaxLength={SEARCH_HISTORY_QUERY_MAX_LENGTH}
      isDisabled={!isReady}
      isFiltersOpen={isFiltersOpen}
      onFiltersOpenToggle={() => setIsFiltersOpen((prev) => !prev)}
      onSearchAreaFocusChange={(isFocused) => {
        setIsSearchHistoryOpen(isFocused);
      }}
      onSearchLeave={() => {
        if (!isSearchDirtyRef.current) {
          return;
        }

        isSearchDirtyRef.current = false;
        onSearchCommit?.(filters.search);
      }}
      onSearchKeyDown={(event) => {
        if (
          isSearchHistoryOpen &&
          (event.key === "ArrowDown" || event.key === "ArrowUp")
        ) {
          const historyItems = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
            "[data-search-history-item]",
          );
          const targetIndex = event.key === "ArrowDown" ? 0 : (historyItems?.length ?? 1) - 1;
          const targetItem = historyItems?.item(targetIndex);

          if (targetItem) {
            event.preventDefault();
            targetItem.focus();
          }
        } else if (event.key === "Enter") {
          event.preventDefault();
          isSearchDirtyRef.current = false;
          onSearchCommit?.(filters.search);
          setIsSearchHistoryOpen(false);
        } else if (event.key === "Escape") {
          setIsSearchHistoryOpen(false);
        }
      }}
      searchSuggestionsSlot={
        isSearchHistoryOpen && visibleSearchHistory.length > 0 ? (
          <SearchHistoryMenu
            id={searchHistoryId}
            items={visibleSearchHistory}
            onSelect={handleSearchHistorySelect}
            onRemove={(query) => {
              if (isSameSearchQuery(filters.search, query)) {
                isSearchDirtyRef.current = false;
              }
              onSearchHistoryRemove?.(query);
            }}
            onClose={() => setIsSearchHistoryOpen(false)}
            onClear={() => {
              if (
                searchHistory.some((query) =>
                  isSameSearchQuery(filters.search, query),
                )
              ) {
                isSearchDirtyRef.current = false;
              }
              onSearchHistoryClear?.();
              setIsSearchHistoryOpen(false);
            }}
          />
        ) : null
      }
      searchSuggestionsId={searchHistoryId}
      isSearchSuggestionsOpen={
        isSearchHistoryOpen && visibleSearchHistory.length > 0
      }
      collapsedCategoriesSlot={collapsedCategoriesSlot}
    >
      <div className="flex flex-col gap-4">
        {/* Expanded Category Selector / Tag Search */}
        <div className="flex flex-col gap-2.5 rounded-2xl border border-[var(--liquid-glass-border)] bg-[#fff] dark:bg-black/60 p-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              value={tagSearchQuery}
              onChange={(e) => setTagSearchQuery(e.target.value)}
              placeholder={t("SearchTagsPlaceholder")}
              className={`pl-10 ${filterFieldClassName}`}
            />
          </div>

          <div
            ref={expandedCategoriesRef}
            className="flex max-h-40 flex-wrap gap-2 overflow-y-auto p-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          >
            {filteredCategories.map((category) => {
              const isSelected = resolveCategoryId(filters.category) === category.id;
              const categoryLabel = getCategoryItemLabel(category, locale);

              return (
                <button
                  key={category.id}
                  type="button"
                  ref={isSelected ? keepSelectedCategoryVisible : undefined}
                  onClick={() => handleToggleCategory(category.id)}
                  className={`group flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium transition-all ${
                    isSelected
                      ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 shadow-sm"
                      : category.myPromotion
                        ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
                        : "border-black/10 bg-black/5 text-zinc-700 hover:border-black/20 hover:bg-black/10 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300 dark:hover:border-white/20 dark:hover:bg-white/10"
                  }`}
                >
                  <span
                    className={`flex h-3.5 w-3.5 items-center justify-center rounded-full border ${
                      isSelected
                        ? "border-white bg-white text-zinc-900 dark:border-zinc-900 dark:bg-zinc-900 dark:text-zinc-100"
                        : "border-zinc-400 bg-transparent group-hover:border-zinc-600 dark:border-zinc-600"
                    }`}
                  >
                    {isSelected ? <Check className="h-2.5 w-2.5 stroke-[3]" /> : null}
                  </span>
                  <span>
                    {categoryLabel}
                    {category.myPromotion ? t("PromotedSuffix") : ""}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
          <ResponsiveSelect
            value={filters.type}
            onChange={(type) => setFilters((current) => ({ ...current, type }))}
            options={typeOptions}
          />
          <ResponsiveSelect
            value={filters.status}
            onChange={(status) => setFilters((current) => ({ ...current, status }))}
            options={statusOptions}
          />
          <ResponsiveSelect
            value={filters.isEscrow}
            onChange={(isEscrow) => setFilters((current) => ({ ...current, isEscrow }))}
            options={isEscrowOptions}
            placeholder={t("DealTypePlaceholder")}
          />
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 bg-transparent px-2 md:col-span-2 xl:col-span-2 sm:gap-x-6">
            <label className={`${checkboxLabelClassName} cursor-pointer`}>
              <input
                type="checkbox"
                checked={filters.mineOnly}
                onChange={(e) => setFilters((current) => ({ ...current, mineOnly: e.target.checked }))}
                className="peer sr-only"
              />
              <span
                aria-hidden="true"
                className={`${checkboxBoxClassName} ${
                  filters.mineOnly
                    ? "border-[var(--foreground)] bg-[var(--foreground)]"
                    : "border-[var(--liquid-glass-border)] bg-transparent"
                }`}
              >
                {filters.mineOnly ? <Check className="h-3 w-3 text-[var(--background)]" /> : null}
              </span>
              {t("OwnershipMine")}
            </label>
            {!forDeals ? (
              <label className={`${checkboxLabelClassName} cursor-pointer`}>
                <input
                  type="checkbox"
                  checked={filters.hideScouted}
                  onChange={(e) => setFilters((current) => ({ ...current, hideScouted: e.target.checked }))}
                  className="peer sr-only"
                />
                <span
                  aria-hidden="true"
                  className={`${checkboxBoxClassName} ${
                    filters.hideScouted
                      ? "border-[var(--foreground)] bg-[var(--foreground)]"
                      : "border-[var(--liquid-glass-border)] bg-transparent"
                  }`}
                >
                  {filters.hideScouted ? <Check className="h-3 w-3 text-[var(--background)]" /> : null}
                </span>
                {t("HideScouted")}
              </label>
            ) : null}
            {!forDeals ? (
              <label
                className={`${checkboxLabelClassName} ${
                  favoritesEnabled ? "cursor-pointer" : "cursor-wait opacity-60"
                }`}
              >
                <input
                  type="checkbox"
                  checked={filters.favoritesOnly}
                  disabled={!favoritesEnabled}
                  onChange={(event) => {
                    const checked = event.target.checked;

                    if (onFavoritesOnlyChange) {
                      onFavoritesOnlyChange(checked);
                      return;
                    }

                    setFilters((current) => ({ ...current, favoritesOnly: checked }));
                  }}
                  className="peer sr-only"
                />
                <span
                  aria-hidden="true"
                  className={`${checkboxBoxClassName} ${
                    filters.favoritesOnly
                      ? "border-[var(--foreground)] bg-[var(--foreground)]"
                      : "border-[var(--liquid-glass-border)] bg-transparent"
                  }`}
                >
                  {filters.favoritesOnly ? (
                    <Check className="h-3 w-3 text-[var(--background)]" />
                  ) : null}
                </span>
                {t("FavoritesOnly")}
              </label>
            ) : null}
          </div>
          <div className="flex gap-2 xl:col-span-1">
            <input
              type="number"
              value={filters.minPrice}
              onChange={(event) =>
                setFilters((current) => ({ ...current, minPrice: event.target.value }))
              }
              placeholder={t("MinPricePlaceholder")}
              className={`w-1/2 ${filterFieldClassName}`}
            />
            <input
              type="number"
              value={filters.maxPrice}
              onChange={(event) =>
                setFilters((current) => ({ ...current, maxPrice: event.target.value }))
              }
              placeholder={t("MaxPricePlaceholder")}
              className={`w-1/2 ${filterFieldClassName}`}
            />
          </div>
          <div className="flex gap-2 xl:col-span-1">
            <input
              type="number"
              value={filters.minDeadline}
              onChange={(event) =>
                setFilters((current) => ({ ...current, minDeadline: event.target.value }))
              }
              placeholder={t("MinDeadlinePlaceholder")}
              className={`w-1/2 ${filterFieldClassName}`}
            />
            <input
              type="number"
              value={filters.maxDeadline}
              onChange={(event) =>
                setFilters((current) => ({ ...current, maxDeadline: event.target.value }))
              }
              placeholder={t("MaxDeadlinePlaceholder")}
              className={`w-1/2 ${filterFieldClassName}`}
            />
          </div>
          <div className={`flex items-center gap-3 ${filterFieldClassName}`}>
            <span className="text-zinc-500 whitespace-nowrap">{t("MinRatingLabel")}</span>
            <div className="flex-1 flex justify-center">
              <RatingStars
                value={filters.minRating ? Number(filters.minRating) : null}
                onChange={(val) => setFilters((current) => ({ ...current, minRating: String(val) }))}
                interactive
              />
            </div>
            {filters.minRating && (
              <button
                onClick={() => setFilters((current) => ({ ...current, minRating: "" }))}
                className="text-zinc-400 hover:text-zinc-600 transition-colors"
                title={t("ResetRatingTitle")}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <ResponsiveSelect
            value={filters.period}
            onChange={(period) => setFilters((current) => ({ ...current, period }))}
            options={periodOptions}
          />
          <div className="flex gap-2 xl:col-span-1">
            <div className="flex-1">
              <ResponsiveSelect
                value={filters.sortBy}
                onChange={(sortBy) =>
                  setFilters((current) => ({
                    ...current,
                    sortBy,
                    sortOrder: sortBy ? current.sortOrder : "asc",
                  }))
                }
                options={sortOptions}
                placeholder={t("SortByPlaceholder")}
              />
            </div>
            <button
              type="button"
              disabled={!filters.sortBy}
              onClick={() =>
                setFilters((current) => ({
                  ...current,
                  sortOrder: current.sortOrder === "asc" ? "desc" : "asc",
                }))
              }
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-colors disabled:cursor-default disabled:opacity-50 ${liquidGlassClassName}`}
              title={filters.sortOrder === "asc" ? t("SortAscendingTitle") : t("SortDescendingTitle")}
            >
              {filters.sortOrder === "asc" ? (
                <ArrowUp className="h-5 w-5" />
              ) : (
                <ArrowDown className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        {onResetFilters ? (
          <div className="flex border-t border-[var(--liquid-glass-border)] pt-3 sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!hasActiveFilters}
              onClick={handleResetFilters}
              className="w-full sm:w-auto"
            >
              <RotateCcw className="h-4 w-4" />
              {t("ResetFilters")}
            </Button>
          </div>
        ) : null}
      </div>
    </ExpandableSearch>
  );
}

function DraggableCategorySlider({
  categories,
  selectedCategory,
  onSelectCategory,
}: {
  categories: CategoryItem[];
  selectedCategory: string;
  onSelectCategory: (id: string) => void;
}) {
  const locale = useLocale();
  const t = useTranslations("SearchFilter");
  const scrollRef = useRef<HTMLDivElement>(null);
  const isMouseDownRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const isDraggingRef = useRef(false);
  const [isGrabbing, setIsGrabbing] = useState(false);

  const orderedCategories = useMemo(() => {
    if (!selectedCategory) return categories;
    const selectedCategoryId = resolveCategoryId(selectedCategory);
    const selectedIdx = categories.findIndex(
      (category) => category.id === selectedCategoryId,
    );
    if (selectedIdx <= 0) return categories;
    const active = categories[selectedIdx];
    const rest = categories.filter((_, idx) => idx !== selectedIdx);
    return [active, ...rest];
  }, [categories, selectedCategory]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    isMouseDownRef.current = true;
    isDraggingRef.current = false;
    startXRef.current = e.pageX - scrollRef.current.offsetLeft;
    scrollLeftRef.current = scrollRef.current.scrollLeft;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDownRef.current || !scrollRef.current) return;
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = x - startXRef.current;
    if (Math.abs(walk) > 4) {
      isDraggingRef.current = true;
      setIsGrabbing(true);
    }
    scrollRef.current.scrollLeft = scrollLeftRef.current - walk * 1.2;
  };

  const handleMouseUpOrLeave = () => {
    isMouseDownRef.current = false;
    setIsGrabbing(false);
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 50);
  };

  const handleCategoryClick = (categoryId: string) => {
    if (isDraggingRef.current) return;
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ left: 0, behavior: "smooth" });
    }
    onSelectCategory(categoryId);
  };

  return (
    <div
      ref={scrollRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUpOrLeave}
      onMouseLeave={handleMouseUpOrLeave}
      className={`flex items-center gap-2 overflow-x-auto py-0.5 select-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${
        isGrabbing ? "cursor-grabbing" : "cursor-grab"
      }`}
    >
      {orderedCategories.map((category) => {
        const isSelected = resolveCategoryId(selectedCategory) === category.id;
        const categoryLabel = getCategoryItemLabel(category, locale);

        return (
          <button
            key={category.id}
            type="button"
            onClick={() => handleCategoryClick(category.id)}
            className={`group flex items-center gap-2 whitespace-nowrap rounded-2xl border px-3.5 py-1.5 text-xs font-medium transition-all ${
              isSelected
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 shadow-sm"
                : category.myPromotion
                  ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
                  : "border-black/10 bg-black/5 text-zinc-700 hover:border-black/20 hover:bg-black/10 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300 dark:hover:border-white/20 dark:hover:bg-white/10"
            }`}
          >
            <span
              className={`flex h-3.5 w-3.5 items-center justify-center rounded-full border ${
                isSelected
                  ? "border-white bg-white text-zinc-900 dark:border-zinc-900 dark:bg-zinc-900 dark:text-zinc-100"
                  : "border-zinc-400 bg-transparent group-hover:border-zinc-600 dark:border-zinc-600"
              }`}
            >
              {isSelected ? <Check className="h-2.5 w-2.5 stroke-[3]" /> : null}
            </span>
            <span>
              {categoryLabel}
              {category.myPromotion ? t("PromotedSuffix") : ""}
            </span>
          </button>
        );
      })}
    </div>
  );
}
