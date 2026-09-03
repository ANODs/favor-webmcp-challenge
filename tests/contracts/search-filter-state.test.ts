import assert from "node:assert/strict";
import test from "node:test";

import {
  SEARCH_HISTORY_LIMIT,
  addSearchHistoryItem,
  areSearchFiltersEqual,
  areSearchFiltersEqualExceptSearch,
  createDefaultSearchFilters,
  getSearchFiltersStorageKey,
  getSearchHistoryStorageKey,
  getSearchStorageOwner,
  mergeSearchHistory,
  parseSearchFilters,
  parseSearchHistory,
  removeSearchHistoryItem,
  serializeSearchFilters,
  serializeSearchHistory,
} from "../../src/widgets/search-filter/lib/search-filter-state";

const historyQueries = (
  history: ReadonlyArray<{ query: string }>,
) => history.map((item) => item.query);

test("search filters expose stable defaults and detect active values", () => {
  const defaults = createDefaultSearchFilters();

  assert.deepEqual(defaults, {
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
  });
  assert.equal(
    areSearchFiltersEqual(defaults, createDefaultSearchFilters()),
    true,
  );
  assert.equal(
    areSearchFiltersEqual(
      defaults,
      createDefaultSearchFilters({ category: "design" }),
    ),
    false,
  );
  assert.equal(
    areSearchFiltersEqualExceptSearch(
      defaults,
      createDefaultSearchFilters({ search: "telegram" }),
    ),
    true,
  );
  assert.equal(
    areSearchFiltersEqualExceptSearch(
      defaults,
      createDefaultSearchFilters({ category: "design" }),
    ),
    false,
  );
});

test("search filter and history storage keys are isolated by scope", () => {
  const contractFiltersKey = getSearchFiltersStorageKey("contracts");
  const dealFiltersKey = getSearchFiltersStorageKey("deals");
  const contractHistoryKey = getSearchHistoryStorageKey("contracts");
  const dealHistoryKey = getSearchHistoryStorageKey("deals");

  assert.notEqual(contractFiltersKey, dealFiltersKey);
  assert.notEqual(contractHistoryKey, dealHistoryKey);
  assert.match(contractFiltersKey, /:contracts:/u);
  assert.match(dealFiltersKey, /:deals:/u);
  assert.match(contractHistoryKey, /:contracts:/u);
  assert.match(dealHistoryKey, /:deals:/u);

  assert.equal(getSearchStorageOwner(null), "guest");
  assert.equal(getSearchStorageOwner(42), "user:42");
  assert.notEqual(
    getSearchHistoryStorageKey("contracts", "user:41"),
    getSearchHistoryStorageKey("contracts", "user:42"),
  );
  assert.notEqual(
    getSearchFiltersStorageKey("contracts", "user:41"),
    getSearchFiltersStorageKey("contracts", "user:42"),
  );
});

test("search filters serialize and restore every persisted value", () => {
  const filters = createDefaultSearchFilters({
    search: "telegram bot",
    category: "development",
    type: "offer",
    status: "active",
    isEscrow: "true",
    minPrice: "10",
    maxPrice: "200",
    minDeadline: "2",
    maxDeadline: "14",
    minRating: "4",
    period: "week",
    mineOnly: true,
    hideScouted: true,
    favoritesOnly: true,
    sortBy: "price",
    sortOrder: "asc",
  });

  assert.deepEqual(parseSearchFilters(serializeSearchFilters(filters)), filters);
});

test("search filter parsing tolerates corrupt snapshots and normalizes invalid fields", () => {
  const fallback = createDefaultSearchFilters({
    category: "fallback-category",
    sortBy: "price",
  });
  const parsed = parseSearchFilters(
    JSON.stringify({
      version: 1,
      filters: {
        search: "restored search",
        type: "unsupported",
        isEscrow: "sometimes",
        period: "year",
        mineOnly: "yes",
        sortOrder: "newest",
      },
    }),
    fallback,
  );

  assert.deepEqual(parsed, {
    ...fallback,
    search: "restored search",
  });
  assert.equal(parseSearchFilters("{not-json", fallback), null);
  assert.equal(
    parseSearchFilters(
      JSON.stringify({ version: 999, filters: fallback }),
      fallback,
    ),
    null,
  );
  assert.equal(
    parseSearchFilters(
      JSON.stringify({ version: 1, filters: "invalid" }),
      fallback,
    ),
    null,
  );
});

test("search history trims queries, keeps MRU order and deduplicates case-insensitively", () => {
  let history = addSearchHistoryItem(
    [],
    "  First query  ",
    "2026-08-30T10:00:00.000Z",
  );
  history = addSearchHistoryItem(
    history,
    "Second query",
    "2026-08-30T10:01:00.000Z",
  );
  history = addSearchHistoryItem(
    history,
    " first QUERY ",
    "2026-08-30T10:02:00.000Z",
  );

  assert.deepEqual(historyQueries(history), ["first QUERY", "Second query"]);
  assert.deepEqual(addSearchHistoryItem(history, "   "), history);
});

test("search history keeps only the newest bounded set", () => {
  let history: Array<{ query: string; searchedAt: string }> = [];

  for (let index = 0; index < SEARCH_HISTORY_LIMIT + 3; index += 1) {
    history = addSearchHistoryItem(
      history,
      `query-${index}`,
      new Date(index).toISOString(),
    );
  }

  assert.equal(history.length, SEARCH_HISTORY_LIMIT);
  assert.equal(history[0]?.query, `query-${SEARCH_HISTORY_LIMIT + 2}`);
  assert.equal(history.at(-1)?.query, "query-3");
});

test("search history removes one query case-insensitively", () => {
  const history = [
    { query: "First query", searchedAt: "2026-08-30T10:00:00.000Z" },
    { query: "Second query", searchedAt: "2026-08-30T09:00:00.000Z" },
  ];
  assert.deepEqual(
    historyQueries(removeSearchHistoryItem(history, " first QUERY ")),
    ["Second query"],
  );
});

test("search history serialization parses, normalizes and rejects corrupt snapshots", () => {
  const history = [
    { query: "First query", searchedAt: "2026-08-30T10:00:00.000Z" },
    { query: "Second query", searchedAt: "2026-08-30T09:00:00.000Z" },
  ];
  assert.deepEqual(
    parseSearchHistory(serializeSearchHistory(history)),
    history,
  );
  assert.deepEqual(
    historyQueries(
      parseSearchHistory(
        JSON.stringify({
          version: 1,
          items: ["  First query  ", "FIRST QUERY", "", 42, "Second query"],
        }),
      ),
    ),
    ["First query", "Second query"],
  );
  assert.deepEqual(parseSearchHistory("{not-json"), []);
  assert.deepEqual(
    parseSearchHistory(JSON.stringify({ version: 999, items: ["query"] })),
    [],
  );
  assert.deepEqual(
    parseSearchHistory(JSON.stringify({ version: 2, items: "invalid" })),
    [],
  );
});

test("local and server search history merge by time and keep unique recent queries", () => {
  const merged = mergeSearchHistory(
    [
      { query: "Local offline", searchedAt: "2026-08-30T10:03:00.000Z" },
      { query: "Repeated", searchedAt: "2026-08-30T10:01:00.000Z" },
    ],
    [
      { query: "Remote", searchedAt: "2026-08-30T10:02:00.000Z" },
      { query: " repeated ", searchedAt: "2026-08-30T10:00:00.000Z" },
    ],
  );

  assert.deepEqual(historyQueries(merged), [
    "Local offline",
    "Remote",
    "Repeated",
  ]);
});

test("search store isolates owners, restores filters and treats server history as authoritative", async () => {
  class MemoryStorage implements Storage {
    private readonly values = new Map<string, string>();

    get length() {
      return this.values.size;
    }

    clear() {
      this.values.clear();
    }

    getItem(key: string) {
      return this.values.get(key) ?? null;
    }

    key(index: number) {
      return [...this.values.keys()][index] ?? null;
    }

    removeItem(key: string) {
      this.values.delete(key);
    }

    setItem(key: string, value: string) {
      this.values.set(key, value);
    }
  }

  const originalWindow = globalThis.window;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: new MemoryStorage(),
      sessionStorage: new MemoryStorage(),
    },
  });

  try {
    const { searchFilterStore } = await import(
      "../../src/widgets/search-filter/model/search-filter-store"
    );

    searchFilterStore.setOwner("deals", "user:41");
    searchFilterStore.setFilters("deals", (current) => ({
      ...current,
      category: "design",
    }));
    searchFilterStore.rememberSearch(
      "deals",
      "User A query",
      "2026-08-30T12:00:00.000Z",
    );

    searchFilterStore.setOwner("deals", "user:42");
    assert.equal(searchFilterStore.getSnapshot("deals").filters.category, "");
    assert.deepEqual(searchFilterStore.getSnapshot("deals").searchHistory, []);

    searchFilterStore.setFilters("deals", (current) => ({
      ...current,
      category: "development",
    }));
    searchFilterStore.rememberSearch(
      "deals",
      "User B local query",
      "2026-08-30T12:01:00.000Z",
    );

    searchFilterStore.setOwner("deals", "user:41");
    assert.equal(
      searchFilterStore.getSnapshot("deals").filters.category,
      "design",
    );
    assert.deepEqual(
      historyQueries(searchFilterStore.getSnapshot("deals").searchHistory),
      ["User A query"],
    );

    searchFilterStore.resetFilters("deals");
    assert.deepEqual(
      historyQueries(searchFilterStore.getSnapshot("deals").searchHistory),
      ["User A query"],
    );

    searchFilterStore.setOwner("deals", "user:42");
    searchFilterStore.replaceSearchHistory("deals", "user:42", [
      {
        query: "User B server query",
        searchedAt: "2026-08-30T12:02:00.000Z",
      },
    ]);
    assert.deepEqual(
      searchFilterStore.getSnapshot("deals").searchHistory,
      [
        {
          query: "User B server query",
          searchedAt: "2026-08-30T12:02:00.000Z",
        },
      ],
    );
  } finally {
    if (originalWindow === undefined) {
      Reflect.deleteProperty(globalThis, "window");
    } else {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: originalWindow,
      });
    }
  }
});
