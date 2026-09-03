import {
  SEARCH_HISTORY_LIMIT as SHARED_SEARCH_HISTORY_LIMIT,
  SEARCH_HISTORY_QUERY_MAX_LENGTH,
  type SearchHistoryScope,
} from "@/entities/search-history";

import type { SearchFiltersState } from "./types";

export type SearchFilterScope = SearchHistoryScope;
export type SearchStorageOwner = "guest" | `user:${number}`;

export type StoredSearchHistoryItem = {
  query: string;
  searchedAt: string;
};

export const SEARCH_HISTORY_LIMIT = SHARED_SEARCH_HISTORY_LIMIT;

const SEARCH_FILTERS_STORAGE_VERSION = 1;
const SEARCH_HISTORY_STORAGE_VERSION = 2;
const LEGACY_SEARCH_TIMESTAMP = new Date(0).toISOString();

export const defaultSearchFilters: Readonly<SearchFiltersState> = {
  search: "",
  category: "",
  type: "",
  status: "",
  isEscrow: "",
  minPrice: "",
  maxPrice: "",
  minDeadline: "",
  maxDeadline: "",
  minRating: "",
  period: "",
  mineOnly: false,
  hideScouted: false,
  favoritesOnly: false,
  sortBy: "deals",
  sortOrder: "desc",
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const getString = (value: unknown, fallback: string) =>
  typeof value === "string" ? value : fallback;

const getBoundedString = (
  value: unknown,
  fallback: string,
  maxLength: number,
) => getString(value, fallback).slice(0, maxLength);

const getBoolean = (value: unknown, fallback: boolean) =>
  typeof value === "boolean" ? value : fallback;

export const createDefaultSearchFilters = (
  initialState?: Partial<SearchFiltersState>,
): SearchFiltersState => ({
  ...defaultSearchFilters,
  ...initialState,
});

export const normalizeSearchFilters = (
  value: unknown,
  fallback: SearchFiltersState = createDefaultSearchFilters(),
): SearchFiltersState => {
  const source = isRecord(value) ? value : {};

  return {
    search: getBoundedString(
      source.search,
      fallback.search,
      SEARCH_HISTORY_QUERY_MAX_LENGTH,
    ),
    category: getBoundedString(source.category, fallback.category, 120),
    type:
      source.type === "offer" || source.type === "order" || source.type === ""
        ? source.type
        : fallback.type,
    status: getBoundedString(source.status, fallback.status, 64),
    isEscrow:
      source.isEscrow === "true" ||
      source.isEscrow === "false" ||
      source.isEscrow === ""
        ? source.isEscrow
        : fallback.isEscrow,
    minPrice: getBoundedString(source.minPrice, fallback.minPrice, 32),
    maxPrice: getBoundedString(source.maxPrice, fallback.maxPrice, 32),
    minDeadline: getBoundedString(
      source.minDeadline,
      fallback.minDeadline,
      16,
    ),
    maxDeadline: getBoundedString(
      source.maxDeadline,
      fallback.maxDeadline,
      16,
    ),
    minRating: getBoundedString(source.minRating, fallback.minRating, 16),
    period:
      source.period === "day" ||
      source.period === "week" ||
      source.period === "month" ||
      source.period === ""
        ? source.period
        : fallback.period,
    mineOnly: getBoolean(source.mineOnly, fallback.mineOnly),
    hideScouted: getBoolean(source.hideScouted, fallback.hideScouted),
    favoritesOnly: getBoolean(source.favoritesOnly, fallback.favoritesOnly),
    sortBy:
      source.sortBy === "price" || source.sortBy === "deals" || source.sortBy === ""
        ? source.sortBy
        : fallback.sortBy,
    sortOrder:
      source.sortOrder === "asc" || source.sortOrder === "desc"
        ? source.sortOrder
        : fallback.sortOrder,
  };
};

export const getSearchStorageOwner = (
  userId: number | null | undefined,
): SearchStorageOwner =>
  userId && userId > 0 ? `user:${userId}` : "guest";

export const getSearchFiltersStorageKey = (
  scope: SearchFilterScope,
  owner: SearchStorageOwner = "guest",
) =>
  `favor:search-filters:${scope}:${owner}:v${SEARCH_FILTERS_STORAGE_VERSION}`;

export const getSearchHistoryStorageKey = (
  scope: SearchFilterScope,
  owner: SearchStorageOwner = "guest",
) =>
  `favor:search-history:${scope}:${owner}:v${SEARCH_HISTORY_STORAGE_VERSION}`;

export const serializeSearchFilters = (filters: SearchFiltersState) =>
  JSON.stringify({
    version: SEARCH_FILTERS_STORAGE_VERSION,
    filters,
  });

export const parseSearchFilters = (
  rawValue: string | null,
  fallback: SearchFiltersState = createDefaultSearchFilters(),
): SearchFiltersState | null => {
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    if (
      !isRecord(parsed) ||
      parsed.version !== SEARCH_FILTERS_STORAGE_VERSION ||
      !isRecord(parsed.filters)
    ) {
      return null;
    }

    return normalizeSearchFilters(parsed.filters, fallback);
  } catch {
    return null;
  }
};

export const normalizeSearchQuery = (query: string) =>
  query.trim().slice(0, SEARCH_HISTORY_QUERY_MAX_LENGTH);

const normalizeSearchTimestamp = (value: unknown) => {
  if (typeof value !== "string") {
    return LEGACY_SEARCH_TIMESTAMP;
  }

  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime())
    ? LEGACY_SEARCH_TIMESTAMP
    : timestamp.toISOString();
};

export const addSearchHistoryItem = (
  history: readonly StoredSearchHistoryItem[],
  query: string,
  searchedAt = new Date().toISOString(),
): StoredSearchHistoryItem[] => {
  const normalizedQuery = normalizeSearchQuery(query);
  if (!normalizedQuery) {
    return [...history];
  }

  const comparableQuery = normalizedQuery.toLocaleLowerCase();
  return [
    {
      query: normalizedQuery,
      searchedAt: normalizeSearchTimestamp(searchedAt),
    },
    ...history.filter(
      (item) =>
        normalizeSearchQuery(item.query).toLocaleLowerCase() !== comparableQuery,
    ),
  ].slice(0, SEARCH_HISTORY_LIMIT);
};

export const removeSearchHistoryItem = (
  history: readonly StoredSearchHistoryItem[],
  query: string,
): StoredSearchHistoryItem[] => {
  const comparableQuery = normalizeSearchQuery(query).toLocaleLowerCase();
  return history.filter(
    (item) =>
      normalizeSearchQuery(item.query).toLocaleLowerCase() !== comparableQuery,
  );
};

export const normalizeSearchHistory = (
  value: unknown,
): StoredSearchHistoryItem[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const history: StoredSearchHistoryItem[] = [];
  const seenQueries = new Set<string>();

  for (const item of value) {
    const query =
      typeof item === "string"
        ? item
        : isRecord(item) && typeof item.query === "string"
          ? item.query
          : null;
    if (query === null) {
      continue;
    }

    const normalizedQuery = normalizeSearchQuery(query);
    const comparableQuery = normalizedQuery.toLocaleLowerCase();
    if (!normalizedQuery || seenQueries.has(comparableQuery)) {
      continue;
    }

    history.push({
      query: normalizedQuery,
      searchedAt:
        isRecord(item) && "searchedAt" in item
          ? normalizeSearchTimestamp(item.searchedAt)
          : LEGACY_SEARCH_TIMESTAMP,
    });
    seenQueries.add(comparableQuery);

    if (history.length === SEARCH_HISTORY_LIMIT) {
      break;
    }
  }

  return history;
};

export const mergeSearchHistory = (
  ...sources: ReadonlyArray<readonly StoredSearchHistoryItem[]>
) =>
  normalizeSearchHistory(
    sources
      .flat()
      .map((item, index) => ({ item, index }))
      .sort((left, right) => {
        const timestampDifference =
          new Date(right.item.searchedAt).getTime() -
          new Date(left.item.searchedAt).getTime();
        return timestampDifference || left.index - right.index;
      })
      .map(({ item }) => item),
  );

export const serializeSearchHistory = (
  history: readonly StoredSearchHistoryItem[],
) =>
  JSON.stringify({
    version: SEARCH_HISTORY_STORAGE_VERSION,
    items: history,
  });

export const parseSearchHistory = (
  rawValue: string | null,
): StoredSearchHistoryItem[] => {
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    if (
      !isRecord(parsed) ||
      (parsed.version !== 1 &&
        parsed.version !== SEARCH_HISTORY_STORAGE_VERSION)
    ) {
      return [];
    }

    return normalizeSearchHistory(parsed.items);
  } catch {
    return [];
  }
};

export const areSearchFiltersEqual = (
  left: SearchFiltersState,
  right: SearchFiltersState,
) =>
  (Object.keys(defaultSearchFilters) as Array<keyof SearchFiltersState>).every(
    (key) => left[key] === right[key],
  );

export const areSearchFiltersEqualExceptSearch = (
  left: SearchFiltersState,
  right: SearchFiltersState,
) =>
  (Object.keys(defaultSearchFilters) as Array<keyof SearchFiltersState>).every(
    (key) => key === "search" || left[key] === right[key],
  );
