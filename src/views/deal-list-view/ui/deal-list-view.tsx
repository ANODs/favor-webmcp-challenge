"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useTranslations } from "next-intl";

import { authClient, sessionQueryKeys } from "@/entities/session";
import { resolveCategoryId } from "@/entities/category";
import { dealsClient } from "@/entities/deal";
import { EmptyState, SurfaceCard } from "@/shared/ui";
import { DealCard, DealCardSkeleton } from "@/widgets/deal-list";
import { SearchFilterWidget, useSearchFilters } from "@/widgets/search-filter";

export function DealListView() {
  const {
    filters,
    setFilters,
    isFiltersOpen,
    setIsFiltersOpen,
    resetFilters,
    hasActiveFilters,
    searchHistory,
    rememberSearch,
    removeSearch,
    clearSearchHistory,
    isHydrated,
  } = useSearchFilters("deals");
  const t = useTranslations("Deals");
  const meQuery = useQuery({
    queryKey: sessionQueryKeys.currentUser,
    queryFn: authClient.getMe,
  });
  const dealsQuery = useQuery({
    queryKey: ["deals"],
    queryFn: dealsClient.getList,
  });

  const filteredDeals = useMemo(() => {
    if (!dealsQuery.data) {
      return [];
    }

    let result = dealsQuery.data;

    // Search
    if (filters.search) {
      const searchValue = filters.search.trim().toLowerCase();
      result = result.filter((deal) => {
        const haystack = [
          deal.contract?.title,
          deal.details,
          deal.customer?.telegramUsername,
          deal.freelancer?.telegramUsername,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(searchValue);
      });
    }

    // Category
    if (filters.category) {
      const selectedCategoryId = resolveCategoryId(filters.category);
      const legacyCategory = filters.category.trim().toLocaleLowerCase();
      result = result.filter((deal) => {
        const contractCategory = deal.contract?.category;
        return selectedCategoryId
          ? resolveCategoryId(contractCategory) === selectedCategoryId
          : contractCategory?.trim().toLocaleLowerCase() === legacyCategory;
      });
    }

    // Type
    if (filters.type) {
      result = result.filter((deal) => deal.contract?.type === filters.type);
    }

    // Status (matching deal status)
    if (filters.status) {
      result = result.filter((deal) => deal.status === filters.status);
    }

    if (filters.isEscrow) {
      const isEscrow = filters.isEscrow === "true";
      result = result.filter((deal) => deal.isEscrow === isEscrow);
    }

    if (filters.mineOnly && meQuery.data?.id) {
      const currentUserId = meQuery.data.id;
      result = result.filter(
        (deal) =>
          deal.customerId === currentUserId ||
          deal.freelancerId === currentUserId,
      );
    }

    // Price
    if (filters.minPrice) {
      const min = Number(filters.minPrice);
      result = result.filter((deal) => Number(deal.price) >= min);
    }
    if (filters.maxPrice) {
      const max = Number(filters.maxPrice);
      result = result.filter((deal) => Number(deal.price) <= max);
    }

    // Deadline
    if (filters.minDeadline) {
      const min = Number(filters.minDeadline);
      result = result.filter((deal) => deal.deadlineDays !== null && deal.deadlineDays >= min);
    }
    if (filters.maxDeadline) {
      const max = Number(filters.maxDeadline);
      result = result.filter((deal) => deal.deadlineDays !== null && deal.deadlineDays <= max);
    }

    // Rating
    if (filters.minRating) {
      const min = Number(filters.minRating);
      const myId = meQuery.data?.id;
      result = result.filter((deal) => {
        const counterpart = deal.customerId === myId ? deal.freelancer : deal.customer;
        return counterpart?.rating !== null && counterpart?.rating !== undefined && counterpart.rating >= min;
      });
    }

    // Period
    if (filters.period) {
      const now = dealsQuery.dataUpdatedAt;
      const dayMs = 24 * 60 * 60 * 1000;
      let limitMs = 0;

      if (filters.period === "day") limitMs = dayMs;
      if (filters.period === "week") limitMs = 7 * dayMs;
      if (filters.period === "month") limitMs = 30 * dayMs;

      if (limitMs > 0) {
        result = result.filter((deal) => {
          const dealTime = new Date(deal.createdAt).getTime();
          return now - dealTime <= limitMs;
        });
      }
    }

    // Sorting
    if (filters.sortBy) {
      result = [...result].sort((a, b) => {
        let aVal: number = 0;
        let bVal: number = 0;

        if (filters.sortBy === "price") {
          aVal = Number(a.price) || 0;
          bVal = Number(b.price) || 0;
        } else if (filters.sortBy === "deals") {
          // No direct "deals count" on deal, fallback to id
          aVal = a.id;
          bVal = b.id;
        }

        if (aVal < bVal) return filters.sortOrder === "asc" ? -1 : 1;
        if (aVal > bVal) return filters.sortOrder === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [dealsQuery.data, dealsQuery.dataUpdatedAt, filters, meQuery.data?.id]);
  const isDealsLoading = !isHydrated || dealsQuery.isLoading;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-6">
      <SearchFilterWidget
        filters={filters}
        setFilters={setFilters}
        isFiltersOpen={isFiltersOpen}
        setIsFiltersOpen={setIsFiltersOpen}
        forDeals
        hasActiveFilters={hasActiveFilters}
        onResetFilters={resetFilters}
        searchHistory={searchHistory}
        onSearchCommit={rememberSearch}
        onSearchHistoryRemove={removeSearch}
        onSearchHistoryClear={clearSearchHistory}
        isReady={isHydrated}
      />

      {isDealsLoading ? (
        <div className="grid gap-4">
          <DealCardSkeleton />
          <DealCardSkeleton />
          <DealCardSkeleton />
        </div>
      ) : null}

      {dealsQuery.isError ? (
        <SurfaceCard>
          <p className="text-sm text-red-700">
            {t("LoadingDealsFailed")}
          </p>
        </SurfaceCard>
      ) : null}

      {filteredDeals.length === 0 && !isDealsLoading && !dealsQuery.isError ? (
        <SurfaceCard>
          <EmptyState
            title={t("NoDealsTitle")}
            description={t("NoDealsDesc")}
          />
        </SurfaceCard>
      ) : null}

      <div className="grid gap-4">
        {filteredDeals.map((deal) => (
          <DealCard
            key={deal.id}
            deal={deal}
            currentUserId={meQuery.data?.id ?? null}
            isModerator={meQuery.data?.role === "moderator"}
          />
        ))}
      </div>
    </main>
  );
}
