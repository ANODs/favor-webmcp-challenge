import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

import { searchFilterStore } from "../model/search-filter-store";
import {
  areSearchFiltersEqual,
  areSearchFiltersEqualExceptSearch,
  createDefaultSearchFilters,
  type SearchFilterScope,
} from "./search-filter-state";
import { useSearchHistorySync } from "./use-search-history-sync";
import type { SearchFiltersState } from "./types";

const comparisonDefaults = createDefaultSearchFilters();

export function useLocalSearchFilters(
  initialState?: Partial<SearchFiltersState>,
) {
  const [filters, setFilters] = useState<SearchFiltersState>(() =>
    createDefaultSearchFilters(initialState),
  );
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  return {
    filters,
    setFilters,
    isFiltersOpen,
    setIsFiltersOpen,
  };
}

export function useSearchFilters(scope: SearchFilterScope) {
  const getSnapshot = useCallback(
    () => searchFilterStore.getSnapshot(scope),
    [scope],
  );
  const getServerSnapshot = useCallback(
    () => searchFilterStore.getServerSnapshot(scope),
    [scope],
  );
  const snapshot = useSyncExternalStore(
    searchFilterStore.subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const {
    rememberSearch,
    recordSearchState,
    removeSearch,
    clearSearchHistory,
    storageOwner,
    isSessionLoading,
  } = useSearchHistorySync(scope);
  const isOwnerReady =
    !isSessionLoading && snapshot.owner === storageOwner;
  const filters = isOwnerReady ? snapshot.filters : comparisonDefaults;

  const setFilters = useCallback<Dispatch<SetStateAction<SearchFiltersState>>>(
    (action) => {
      if (isSessionLoading) {
        return;
      }

      searchFilterStore.setOwner(scope, storageOwner);
      const previousFilters = searchFilterStore.getSnapshot(scope).filters;
      const filters = searchFilterStore.setFilters(scope, action);
      if (
        filters &&
        !areSearchFiltersEqualExceptSearch(previousFilters, filters)
      ) {
        recordSearchState(filters, "filter_change");
      }
    },
    [isSessionLoading, recordSearchState, scope, storageOwner],
  );
  const resetFilters = useCallback(() => {
    if (isSessionLoading) {
      return;
    }

    searchFilterStore.setOwner(scope, storageOwner);
    const filters = searchFilterStore.resetFilters(scope);
    if (filters) {
      recordSearchState(filters, "reset");
    }
  }, [isSessionLoading, recordSearchState, scope, storageOwner]);
  const hasActiveFilters = useMemo(
    () => !areSearchFiltersEqual(filters, comparisonDefaults),
    [filters],
  );

  return {
    filters,
    setFilters,
    isFiltersOpen,
    setIsFiltersOpen,
    resetFilters,
    hasActiveFilters,
    searchHistory: isOwnerReady
      ? snapshot.searchHistory.map((item) => item.query)
      : [],
    rememberSearch,
    removeSearch,
    clearSearchHistory,
    isHydrated: snapshot.isHydrated && isOwnerReady,
  };
}
