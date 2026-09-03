import { z } from "zod";

export const SEARCH_HISTORY_API_PATH = "/api/search-history";
export const SEARCH_HISTORY_LIMIT = 8;
export const SEARCH_HISTORY_QUERY_MAX_LENGTH = 200;
export const SEARCH_HISTORY_REQUEST_MAX_BYTES = 8 * 1024;

export const searchHistoryScopeSchema = z.enum(["contracts", "deals"]);
export const searchEventTriggerSchema = z.enum([
  "search_commit",
  "filter_change",
  "reset",
]);

export const normalizeSearchHistoryQuery = (query: string) => query.trim();

export const getSearchHistoryQueryKey = (query: string) =>
  normalizeSearchHistoryQuery(query).toLowerCase();

export const isSearchEventSuppressedByDeletion = (
  trigger: SearchEventTrigger,
  clientSearchedAt: Date | string,
  clientDeletedAt: Date | string | null,
) =>
  trigger === "search_commit" &&
  clientDeletedAt !== null &&
  new Date(clientSearchedAt).getTime() <= new Date(clientDeletedAt).getTime();

export const getEffectiveClientTimestamp = (
  clientTimestamp: Date | string,
  serverNow: Date,
) =>
  new Date(
    Math.min(new Date(clientTimestamp).getTime(), serverNow.getTime()),
  );

const filterText = (maxLength: number) => z.string().max(maxLength);

export const searchFiltersSnapshotSchema = z
  .object({
    search: z.string().max(SEARCH_HISTORY_QUERY_MAX_LENGTH),
    category: filterText(120),
    type: z.enum(["", "offer", "order"]),
    status: filterText(64),
    isEscrow: z.enum(["", "true", "false"]),
    minPrice: filterText(32),
    maxPrice: filterText(32),
    minDeadline: filterText(16),
    maxDeadline: filterText(16),
    minRating: filterText(16),
    period: z.enum(["", "day", "week", "month"]),
    mineOnly: z.boolean(),
    hideScouted: z.boolean(),
    favoritesOnly: z.boolean(),
    sortBy: z.enum(["", "price", "deals"]),
    sortOrder: z.enum(["asc", "desc"]),
  })
  .strict();

export const searchHistoryQuerySchema = z
  .string()
  .trim()
  .min(1)
  .max(SEARCH_HISTORY_QUERY_MAX_LENGTH);

const searchEventQuerySchema = z
  .string()
  .trim()
  .max(SEARCH_HISTORY_QUERY_MAX_LENGTH);

export const recordSearchEventSchema = z
  .object({
    eventId: z.uuid(),
    expectedUserId: z.number().int().positive(),
    scope: searchHistoryScopeSchema,
    query: searchEventQuerySchema,
    filters: searchFiltersSnapshotSchema,
    trigger: searchEventTriggerSchema,
    locale: z.enum(["ru", "en"]).optional(),
    clientSearchedAt: z.iso.datetime({ offset: true }),
  })
  .strict()
  .refine(
    (value) =>
      value.query === normalizeSearchHistoryQuery(value.filters.search),
    {
      message: "Search query must match the filter snapshot.",
      path: ["filters", "search"],
    },
  );

export const searchHistoryListQuerySchema = z
  .object({
    expectedUserId: z.coerce.number().int().positive(),
    scope: searchHistoryScopeSchema,
  })
  .strict();

export const deleteSearchHistorySchema = z
  .object({
    operationId: z.uuid(),
    expectedUserId: z.number().int().positive(),
    scope: searchHistoryScopeSchema,
    query: searchHistoryQuerySchema.optional(),
    clientDeletedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export type SearchHistoryScope = z.infer<typeof searchHistoryScopeSchema>;
export type SearchEventTrigger = z.infer<typeof searchEventTriggerSchema>;
export type SearchFiltersSnapshot = z.infer<
  typeof searchFiltersSnapshotSchema
>;
export type RecordSearchEventInput = z.infer<typeof recordSearchEventSchema>;
export type DeleteSearchHistoryInput = z.infer<
  typeof deleteSearchHistorySchema
>;

export type SearchHistoryItem = {
  query: string;
  searchedAt: string;
  clientSearchedAt: string;
};

export type SearchHistoryRow = {
  query: string;
  clientSearchedAt: Date | string;
  createdAt: Date | string;
};

const toIsoString = (value: Date | string) =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

/**
 * Converts newest-first storage rows into the bounded history shown by the UI.
 * Keeping this transformation pure makes ordering and case-insensitive
 * deduplication independently testable from Prisma and Next.js.
 */
export const buildSearchHistoryItems = (
  newestRows: readonly SearchHistoryRow[],
  limit = SEARCH_HISTORY_LIMIT,
): SearchHistoryItem[] => {
  const items: SearchHistoryItem[] = [];
  const seenQueries = new Set<string>();

  for (const row of newestRows) {
    const query = normalizeSearchHistoryQuery(row.query);
    const queryKey = getSearchHistoryQueryKey(query);
    if (!query || seenQueries.has(queryKey)) {
      continue;
    }

    items.push({
      query,
      searchedAt: toIsoString(row.createdAt),
      clientSearchedAt: toIsoString(row.clientSearchedAt),
    });
    seenQueries.add(queryKey);

    if (items.length >= Math.max(0, limit)) {
      break;
    }
  }

  return items;
};
