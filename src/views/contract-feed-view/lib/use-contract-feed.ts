import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

import { authClient, sessionQueryKeys } from "@/entities/session";
import { contractQueryKeys, contractsClient } from "@/entities/contract";
import {
  toContractListFilters,
  useSearchFilters,
} from "@/widgets/search-filter";

export function useContractFeed() {
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
  } = useSearchFilters("contracts");

  const meQuery = useQuery({
    queryKey: sessionQueryKeys.currentUser,
    queryFn: authClient.getMe,
  });
  const isModerator = meQuery.data?.role === "moderator";
  const isAuthenticated = Boolean(meQuery.data);
  const status =
    isModerator || filters.status === "" || filters.status === "archived"
      ? filters.status
      : "";

  useEffect(() => {
    if (!isHydrated || meQuery.isLoading) {
      return;
    }

    setFilters((current) => {
      const shouldResetStatus =
        !isModerator && current.status !== "" && current.status !== "archived";
      const shouldResetFavorites = !isAuthenticated && current.favoritesOnly;

      if (!shouldResetStatus && !shouldResetFavorites) {
        return current;
      }

      return {
        ...current,
        status: shouldResetStatus ? "" : current.status,
        favoritesOnly: shouldResetFavorites ? false : current.favoritesOnly,
      };
    });
  }, [
    isAuthenticated,
    isHydrated,
    isModerator,
    meQuery.isLoading,
    setFilters,
  ]);

  const contractFilters = useMemo(
    () =>
      toContractListFilters(
        {
          ...filters,
          status,
          favoritesOnly: filters.favoritesOnly && isAuthenticated,
        },
        { isModerator },
      ),
    [filters, isAuthenticated, isModerator, status],
  );

  const contractsQuery = useInfiniteQuery({
    queryKey: contractQueryKeys.list(contractFilters, meQuery.data?.role),
    queryFn: ({ pageParam }) => contractsClient.getList(contractFilters, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: isHydrated && !meQuery.isLoading,
  });
  const contracts = useMemo(
    () => contractsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [contractsQuery.data],
  );

  return {
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
    isSearchFiltersHydrated: isHydrated,
    meQuery,
    isModerator,
    contractsQuery,
    contracts,
  };
}
