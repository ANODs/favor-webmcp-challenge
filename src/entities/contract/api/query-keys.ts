import type { ContractListFilters } from "./contracts-client";

export const contractQueryKeys = {
  all: ["contracts"] as const,
  list: (filters: ContractListFilters, viewerRole?: string | null) =>
    ["contracts", "list", filters, viewerRole ?? null] as const,
  moderationLists: ["contracts", "moderation-list"] as const,
  moderationList: (filters: ContractListFilters) =>
    ["contracts", "moderation-list", filters] as const,
  activeAuthorList: (
    authorId: number | null,
    activeContractsCount: number,
    locale: string,
  ) => [
    "contracts",
    "active-author-list",
    authorId,
    activeContractsCount,
    locale,
  ] as const,
  details: ["contract"] as const,
  detail: (slug: string) => ["contract", slug] as const,
  media: (slug: string) => ["contract-media", slug] as const,
};
