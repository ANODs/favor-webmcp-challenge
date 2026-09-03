import type { ContractListFilters } from "@/entities/contract";

import type { SearchFiltersState } from "./types";

type Options = {
  isModerator: boolean;
};

export function toContractListFilters(
  filters: SearchFiltersState,
  { isModerator }: Options,
): ContractListFilters {
  return {
    search: filters.search || undefined,
    category: filters.category || undefined,
    type: filters.type || undefined,
    status: filters.status || undefined,
    isEscrow: filters.isEscrow || undefined,
    minPrice: filters.minPrice ? Number(filters.minPrice) : undefined,
    maxPrice: filters.maxPrice ? Number(filters.maxPrice) : undefined,
    minDeadline: filters.minDeadline ? Number(filters.minDeadline) : undefined,
    maxDeadline: filters.maxDeadline ? Number(filters.maxDeadline) : undefined,
    minRating: filters.minRating ? Number(filters.minRating) : undefined,
    period: filters.period || undefined,
    sortBy: filters.sortBy || undefined,
    sortOrder: filters.sortOrder || undefined,
    mine:
      (!isModerator && filters.status === "archived") || filters.mineOnly
        ? true
        : undefined,
    hideScouted: filters.hideScouted ? true : undefined,
    favorites: filters.favoritesOnly ? true : undefined,
  };
}
