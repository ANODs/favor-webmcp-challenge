import { useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale } from "next-intl";

import { authClient, sessionQueryKeys } from "@/entities/session";
import {
  SEARCH_HISTORY_QUERY_MAX_LENGTH,
  flushSearchHistoryOutbox,
  isSearchHistoryOutboxStorageKeyForUser,
  queueSearchHistoryDelete,
  queueSearchHistoryRecord,
  searchHistoryClient,
  type SearchEventTrigger,
  type SearchHistoryScope,
} from "@/entities/search-history";

import { searchFilterStore } from "../model/search-filter-store";
import {
  getSearchFiltersStorageKey,
  getSearchHistoryStorageKey,
  getSearchStorageOwner,
  normalizeSearchQuery,
  type SearchFilterScope,
} from "./search-filter-state";
import type { SearchFiltersState } from "./types";

const createClientEventId = () => {
  if (typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const value = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return `${value.slice(0, 4).join("")}-${value.slice(4, 6).join("")}-${value
    .slice(6, 8)
    .join("")}-${value.slice(8, 10).join("")}-${value.slice(10).join("")}`;
};

const asSearchHistoryScope = (scope: SearchFilterScope): SearchHistoryScope =>
  scope;

const LAST_SEARCH_OWNER_STORAGE_KEY = "favor:last-search-owner:v1";
const GUEST_SEARCH_OWNER_HINT = "guest";

const readLastConfirmedOwner = (): number | "guest" | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const storedOwner = window.sessionStorage.getItem(
      LAST_SEARCH_OWNER_STORAGE_KEY,
    );
    if (storedOwner === GUEST_SEARCH_OWNER_HINT) {
      return GUEST_SEARCH_OWNER_HINT;
    }

    const userId = Number(storedOwner);
    return Number.isInteger(userId) && userId > 0 ? userId : null;
  } catch {
    return null;
  }
};

const persistLastConfirmedUserId = (userId: number | null) => {
  try {
    if (userId) {
      window.sessionStorage.setItem(
        LAST_SEARCH_OWNER_STORAGE_KEY,
        String(userId),
      );
    } else {
      window.sessionStorage.setItem(
        LAST_SEARCH_OWNER_STORAGE_KEY,
        GUEST_SEARCH_OWNER_HINT,
      );
    }
  } catch {
    // Search still works when browser storage is restricted.
  }
};

export function useSearchHistorySync(scope: SearchFilterScope) {
  const locale = useLocale();
  const historyScope = asSearchHistoryScope(scope);
  const sessionQuery = useQuery({
    queryKey: sessionQueryKeys.currentUser,
    queryFn: authClient.getMe,
  });
  const resolvedUserId =
    sessionQuery.data?.id && sessionQuery.data.id > 0
      ? sessionQuery.data.id
      : null;
  const lastConfirmedOwner = sessionQuery.isError
    ? readLastConfirmedOwner()
    : null;
  const lastConfirmedUserId =
    typeof lastConfirmedOwner === "number" ? lastConfirmedOwner : null;
  const userId = resolvedUserId ?? lastConfirmedUserId;
  const isOwnerPending =
    sessionQuery.isLoading ||
    (sessionQuery.isError && lastConfirmedOwner === null);
  const storageOwner = getSearchStorageOwner(userId);

  useEffect(() => {
    if (sessionQuery.isSuccess) {
      persistLastConfirmedUserId(resolvedUserId);
    }
  }, [resolvedUserId, sessionQuery.isSuccess]);

  useEffect(() => {
    if (isOwnerPending) {
      return;
    }

    searchFilterStore.setOwner(scope, storageOwner);
    let isActive = true;

    const synchronize = async () => {
      if (!userId) {
        return;
      }

      for (let attempt = 0; attempt < 3; attempt += 1) {
        const outboxFlushed = await flushSearchHistoryOutbox(userId);
        if (!outboxFlushed || !isActive) {
          return;
        }

        const historyRevision =
          searchFilterStore.getSearchHistoryRevision(scope);

        try {
          const serverHistory = await searchHistoryClient.list(
            historyScope,
            userId,
          );
          if (!isActive) {
            return;
          }

          if (
            historyRevision ===
            searchFilterStore.getSearchHistoryRevision(scope)
          ) {
            searchFilterStore.replaceSearchHistory(
              scope,
              storageOwner,
              serverHistory,
            );
            return;
          }
        } catch {
          // Local history stays available while the API or network is unavailable.
          return;
        }
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (
        userId &&
        event.newValue !== null &&
        isSearchHistoryOutboxStorageKeyForUser(event.key, userId)
      ) {
        void synchronize();
        return;
      }

      if (
        event.key === getSearchHistoryStorageKey(scope, storageOwner) ||
        event.key === getSearchFiltersStorageKey(scope, storageOwner)
      ) {
        searchFilterStore.reloadOwner(scope);
      }
    };

    void synchronize();
    window.addEventListener("online", synchronize);
    window.addEventListener("focus", synchronize);
    window.addEventListener("storage", handleStorage);

    return () => {
      isActive = false;
      window.removeEventListener("online", synchronize);
      window.removeEventListener("focus", synchronize);
      window.removeEventListener("storage", handleStorage);
    };
  }, [
    historyScope,
    scope,
    isOwnerPending,
    storageOwner,
    userId,
  ]);

  const recordSearchState = useCallback(
    (filters: SearchFiltersState, trigger: SearchEventTrigger) => {
      if (isOwnerPending || !userId) {
        return;
      }

      const eventId = createClientEventId();
      queueSearchHistoryRecord({
        eventId,
        expectedUserId: userId,
        scope: historyScope,
        query: normalizeSearchQuery(filters.search),
        filters,
        trigger,
        locale: locale === "ru" ? "ru" : "en",
        clientSearchedAt: new Date().toISOString(),
      });
    },
    [historyScope, isOwnerPending, locale, userId],
  );

  const rememberSearch = useCallback(
    (query: string) => {
      if (isOwnerPending) {
        return;
      }

      const searchValue = query.slice(0, SEARCH_HISTORY_QUERY_MAX_LENGTH);
      const normalizedQuery = normalizeSearchQuery(searchValue);
      const clientSearchedAt = new Date().toISOString();
      searchFilterStore.setOwner(scope, storageOwner);
      const filters = {
        ...searchFilterStore.getSnapshot(scope).filters,
        search: searchValue,
      };

      recordSearchState(filters, "search_commit");
      if (!normalizedQuery) {
        return;
      }

      searchFilterStore.rememberSearch(
        scope,
        normalizedQuery,
        clientSearchedAt,
      );
    },
    [
      isOwnerPending,
      recordSearchState,
      scope,
      storageOwner,
    ],
  );

  const removeSearch = useCallback(
    (query: string) => {
      const normalizedQuery = normalizeSearchQuery(query);
      if (!normalizedQuery) {
        return;
      }

      if (isOwnerPending) {
        return;
      }

      searchFilterStore.setOwner(scope, storageOwner);
      searchFilterStore.removeSearch(scope, normalizedQuery);
      if (!userId) {
        return;
      }

      const operationId = createClientEventId();
      queueSearchHistoryDelete(
        {
          operationId,
          expectedUserId: userId,
          scope: historyScope,
          query: normalizedQuery,
          clientDeletedAt: new Date().toISOString(),
        },
        true,
      );
    },
    [
      historyScope,
      scope,
      isOwnerPending,
      storageOwner,
      userId,
    ],
  );

  const clearSearchHistory = useCallback(() => {
    if (isOwnerPending) {
      return;
    }

    searchFilterStore.setOwner(scope, storageOwner);
    searchFilterStore.clearSearchHistory(scope);
    if (!userId) {
      return;
    }

    const operationId = createClientEventId();
    queueSearchHistoryDelete(
      {
        operationId,
        expectedUserId: userId,
        scope: historyScope,
        clientDeletedAt: new Date().toISOString(),
      },
      true,
    );
  }, [
    historyScope,
    scope,
    isOwnerPending,
    storageOwner,
    userId,
  ]);

  return {
    rememberSearch,
    recordSearchState,
    removeSearch,
    clearSearchHistory,
    storageOwner,
    isSessionLoading: isOwnerPending,
  };
}
