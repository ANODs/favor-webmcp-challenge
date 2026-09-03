import assert from "node:assert/strict";
import test from "node:test";

import { contractQueryKeys } from "../../src/entities/contract/api/query-keys";
import { CONTRACT_MODERATION_QUEUE_FILTER } from "../../src/features/contract-ai-moderation/model/moderation-filter";
import { getSortOptions } from "../../src/widgets/search-filter/config/constants";
import { toContractListFilters } from "../../src/widgets/search-filter/lib/to-contract-list-filters";
import type { SearchFiltersState } from "../../src/widgets/search-filter/lib/types";

const createFilters = (
  patch: Partial<SearchFiltersState> = {},
): SearchFiltersState => ({
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
  ...patch,
});

test("feed and moderation filters map every populated field to one API contract", () => {
  const result = toContractListFilters(
    createFilters({
      search: "design",
      category: "design.web",
      type: "offer",
      status: "pending_moderation",
      isEscrow: "true",
      minPrice: "10",
      maxPrice: "250",
      minDeadline: "2",
      maxDeadline: "14",
      minRating: "4",
      period: "week",
      mineOnly: true,
      hideScouted: true,
      favoritesOnly: true,
      sortBy: "price",
      sortOrder: "asc",
    }),
    { isModerator: true },
  );

  assert.deepEqual(result, {
    search: "design",
    category: "design.web",
    type: "offer",
    status: "pending_moderation",
    isEscrow: "true",
    minPrice: 10,
    maxPrice: 250,
    minDeadline: 2,
    maxDeadline: 14,
    minRating: 4,
    period: "week",
    sortBy: "price",
    sortOrder: "asc",
    mine: true,
    hideScouted: true,
    favorites: true,
  });
});

test("archived contracts remain account-scoped only for non-moderators", () => {
  const filters = createFilters({ status: "archived" });

  assert.equal(
    toContractListFilters(filters, { isModerator: false }).mine,
    true,
  );
  assert.equal(
    toContractListFilters(filters, { isModerator: true }).mine,
    undefined,
  );
});

test("moderation pages do not share an infinite-query cache with the feed", () => {
  const filters = toContractListFilters(createFilters(), {
    isModerator: true,
  });

  assert.notDeepEqual(
    contractQueryKeys.moderationList(filters),
    contractQueryKeys.list(filters, "moderator"),
  );
});

test("moderation queue and all statuses remain distinct filter values", () => {
  const queueFilters = toContractListFilters(
    createFilters({ status: CONTRACT_MODERATION_QUEUE_FILTER }),
    { isModerator: true },
  );
  const allStatusFilters = toContractListFilters(
    createFilters({ status: "" }),
    { isModerator: true },
  );

  assert.equal(queueFilters.status, CONTRACT_MODERATION_QUEUE_FILTER);
  assert.equal(allStatusFilters.status, undefined);
});

test("sorting can be reset to the endpoint default", () => {
  const options = getSortOptions((key) => key);

  assert.equal(options[0]?.value, "");
});
