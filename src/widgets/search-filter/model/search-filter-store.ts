import type { SetStateAction } from "react";

import {
  addSearchHistoryItem,
  areSearchFiltersEqual,
  createDefaultSearchFilters,
  getSearchFiltersStorageKey,
  getSearchHistoryStorageKey,
  mergeSearchHistory,
  normalizeSearchFilters,
  parseSearchFilters,
  parseSearchHistory,
  removeSearchHistoryItem,
  serializeSearchFilters,
  serializeSearchHistory,
  type SearchFilterScope,
  type SearchStorageOwner,
  type StoredSearchHistoryItem,
} from "../lib/search-filter-state";
import type { SearchFiltersState } from "../lib/types";

type SearchFilterSnapshot = {
  filters: SearchFiltersState;
  searchHistory: StoredSearchHistoryItem[];
  isHydrated: boolean;
  owner: SearchStorageOwner;
};

const createServerSnapshot = (): SearchFilterSnapshot => ({
  filters: createDefaultSearchFilters(),
  searchHistory: [],
  isHydrated: false,
  owner: "guest",
});

const serverSnapshots: Record<SearchFilterScope, SearchFilterSnapshot> = {
  contracts: createServerSnapshot(),
  deals: createServerSnapshot(),
};

const clientSnapshots: Partial<Record<SearchFilterScope, SearchFilterSnapshot>> = {};
const searchHistoryRevisions: Record<SearchFilterScope, number> = {
  contracts: 0,
  deals: 0,
};
const listeners = new Set<() => void>();

const readClientSnapshot = (scope: SearchFilterScope): SearchFilterSnapshot => {
  const existingSnapshot = clientSnapshots[scope];
  if (existingSnapshot) {
    return existingSnapshot;
  }

  const defaultFilters = createDefaultSearchFilters();
  const owner: SearchStorageOwner = "guest";
  let filters = defaultFilters;
  let searchHistory: StoredSearchHistoryItem[] = [];

  try {
    filters =
      parseSearchFilters(
        window.sessionStorage.getItem(
          getSearchFiltersStorageKey(scope, owner),
        ),
        defaultFilters,
      ) ?? defaultFilters;
  } catch {
    // Restricted webviews can disable storage; in-memory state still works.
  }

  try {
    searchHistory = parseSearchHistory(
      window.localStorage.getItem(
        getSearchHistoryStorageKey(scope, owner),
      ),
    );
  } catch {
    // Search remains usable even when history cannot be restored.
  }

  const snapshot = { filters, searchHistory, isHydrated: true, owner };
  clientSnapshots[scope] = snapshot;
  return snapshot;
};

const emitChange = () => {
  listeners.forEach((listener) => listener());
};

const persistFilters = (
  scope: SearchFilterScope,
  owner: SearchStorageOwner,
  filters: SearchFiltersState,
) => {
  try {
    window.sessionStorage.setItem(
      getSearchFiltersStorageKey(scope, owner),
      serializeSearchFilters(filters),
    );
  } catch {
    // Keep the external store operational without browser persistence.
  }
};

const persistSearchHistory = (
  scope: SearchFilterScope,
  owner: SearchStorageOwner,
  searchHistory: StoredSearchHistoryItem[],
) => {
  try {
    window.localStorage.setItem(
      getSearchHistoryStorageKey(scope, owner),
      serializeSearchHistory(searchHistory),
    );
  } catch {
    // Keep the external store operational without browser persistence.
  }
};

const updateClientSnapshot = (
  scope: SearchFilterScope,
  snapshot: SearchFilterSnapshot,
) => {
  clientSnapshots[scope] = snapshot;
  emitChange();
};

const readOwnerSnapshot = (
  scope: SearchFilterScope,
  owner: SearchStorageOwner,
  current: SearchFilterSnapshot,
): SearchFilterSnapshot => {
  const defaultFilters = createDefaultSearchFilters();
  let filters = defaultFilters;
  let searchHistory: StoredSearchHistoryItem[] = [];

  try {
    filters =
      parseSearchFilters(
        window.sessionStorage.getItem(
          getSearchFiltersStorageKey(scope, owner),
        ),
        defaultFilters,
      ) ?? defaultFilters;
  } catch {
    // The owner still switches when storage is unavailable.
  }

  try {
    searchHistory = parseSearchHistory(
      window.localStorage.getItem(
        getSearchHistoryStorageKey(scope, owner),
      ),
    );
  } catch {
    // The owner still switches when storage is unavailable.
  }

  return { ...current, filters, searchHistory, owner };
};

export const searchFilterStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  getSnapshot(scope: SearchFilterScope) {
    return typeof window === "undefined"
      ? serverSnapshots[scope]
      : readClientSnapshot(scope);
  },

  getServerSnapshot(scope: SearchFilterScope) {
    return serverSnapshots[scope];
  },

  getSearchHistoryRevision(scope: SearchFilterScope) {
    return searchHistoryRevisions[scope];
  },

  setOwner(scope: SearchFilterScope, owner: SearchStorageOwner) {
    if (typeof window === "undefined") {
      return;
    }

    const current = readClientSnapshot(scope);
    if (current.owner === owner) {
      return;
    }

    searchHistoryRevisions[scope] += 1;
    updateClientSnapshot(
      scope,
      readOwnerSnapshot(scope, owner, current),
    );
  },

  reloadOwner(scope: SearchFilterScope) {
    if (typeof window === "undefined") {
      return;
    }

    const current = readClientSnapshot(scope);
    searchHistoryRevisions[scope] += 1;
    updateClientSnapshot(
      scope,
      readOwnerSnapshot(scope, current.owner, current),
    );
  },

  setFilters(scope: SearchFilterScope, action: SetStateAction<SearchFiltersState>) {
    if (typeof window === "undefined") {
      return null;
    }

    const current = readClientSnapshot(scope);
    const nextFilters =
      typeof action === "function" ? action(current.filters) : action;
    const filters = normalizeSearchFilters(nextFilters, current.filters);

    if (
      filters === current.filters ||
      areSearchFiltersEqual(filters, current.filters)
    ) {
      return null;
    }

    persistFilters(scope, current.owner, filters);
    updateClientSnapshot(scope, { ...current, filters });
    return filters;
  },

  resetFilters(scope: SearchFilterScope) {
    if (typeof window === "undefined") {
      return null;
    }

    const current = readClientSnapshot(scope);
    const filters = createDefaultSearchFilters();
    if (areSearchFiltersEqual(filters, current.filters)) {
      return null;
    }

    persistFilters(scope, current.owner, filters);
    updateClientSnapshot(scope, { ...current, filters });
    return filters;
  },

  rememberSearch(
    scope: SearchFilterScope,
    query: string,
    searchedAt?: string,
  ) {
    if (typeof window === "undefined") {
      return;
    }

    const current = readClientSnapshot(scope);
    const searchHistory = addSearchHistoryItem(
      current.searchHistory,
      query,
      searchedAt,
    );
    if (
      searchHistory.length === current.searchHistory.length &&
      searchHistory.every(
        (item, index) =>
          item.query === current.searchHistory[index]?.query &&
          item.searchedAt === current.searchHistory[index]?.searchedAt,
      )
    ) {
      return;
    }

    persistSearchHistory(scope, current.owner, searchHistory);
    searchHistoryRevisions[scope] += 1;
    updateClientSnapshot(scope, { ...current, searchHistory });
  },

  replaceSearchHistory(
    scope: SearchFilterScope,
    owner: SearchStorageOwner,
    serverHistory: readonly StoredSearchHistoryItem[],
  ) {
    if (typeof window === "undefined") {
      return;
    }

    const current = readClientSnapshot(scope);
    if (current.owner !== owner) {
      return;
    }

    const searchHistory = mergeSearchHistory(
      serverHistory.map((item) => ({
        query: item.query,
        searchedAt: item.searchedAt,
      })),
    );
    if (
      searchHistory.length === current.searchHistory.length &&
      searchHistory.every(
        (item, index) =>
          item.query === current.searchHistory[index]?.query &&
          item.searchedAt === current.searchHistory[index]?.searchedAt,
      )
    ) {
      return;
    }

    persistSearchHistory(scope, current.owner, searchHistory);
    updateClientSnapshot(scope, { ...current, searchHistory });
  },

  removeSearch(scope: SearchFilterScope, query: string) {
    if (typeof window === "undefined") {
      return;
    }

    searchHistoryRevisions[scope] += 1;
    const current = readClientSnapshot(scope);
    const searchHistory = removeSearchHistoryItem(current.searchHistory, query);
    if (searchHistory.length === current.searchHistory.length) {
      return;
    }

    persistSearchHistory(scope, current.owner, searchHistory);
    updateClientSnapshot(scope, { ...current, searchHistory });
  },

  clearSearchHistory(scope: SearchFilterScope) {
    if (typeof window === "undefined") {
      return;
    }

    searchHistoryRevisions[scope] += 1;
    const current = readClientSnapshot(scope);
    if (current.searchHistory.length === 0) {
      return;
    }

    const searchHistory: StoredSearchHistoryItem[] = [];
    persistSearchHistory(scope, current.owner, searchHistory);
    updateClientSnapshot(scope, { ...current, searchHistory });
  },
};
