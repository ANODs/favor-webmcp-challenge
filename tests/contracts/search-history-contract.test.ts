import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSearchHistoryItems,
  deleteSearchHistorySchema,
  getEffectiveClientTimestamp,
  getSearchHistoryQueryKey,
  isSearchEventSuppressedByDeletion,
  recordSearchEventSchema,
  searchFiltersSnapshotSchema,
} from "../../src/entities/search-history/model/contracts";
import {
  getSearchHistoryOutboxOperationsForUser,
  parseSearchHistoryOutbox,
  serializeSearchHistoryOutbox,
  type SearchHistoryOutboxOperation,
} from "../../src/entities/search-history/lib/search-history-outbox";

const filters = {
  search: "telegram bot",
  category: "development",
  type: "offer" as const,
  status: "active",
  isEscrow: "true" as const,
  minPrice: "10",
  maxPrice: "200",
  minDeadline: "2",
  maxDeadline: "14",
  minRating: "4",
  period: "week" as const,
  mineOnly: true,
  hideScouted: true,
  favoritesOnly: false,
  sortBy: "price" as const,
  sortOrder: "asc" as const,
};

const recordOperation: SearchHistoryOutboxOperation = {
  id: "1671a12f-d75e-4e93-a2e9-25ac61a6f9a0",
  kind: "record",
  payload: {
    eventId: "1671a12f-d75e-4e93-a2e9-25ac61a6f9a0",
    expectedUserId: 42,
    scope: "contracts",
    query: "telegram bot",
    filters,
    trigger: "search_commit" as const,
    locale: "ru",
    clientSearchedAt: "2026-08-30T12:00:00.000Z",
  },
};

const deleteOperation: SearchHistoryOutboxOperation = {
  id: "bf274cea-412b-4cf8-963f-283ae527d676",
  kind: "delete",
  payload: {
    operationId: "bf274cea-412b-4cf8-963f-283ae527d676",
    expectedUserId: 42,
    scope: "contracts",
    query: "telegram bot",
    clientDeletedAt: "2026-08-30T12:05:00.000Z",
  },
};

test("search event schema keeps the complete bounded filter snapshot", () => {
  assert.deepEqual(searchFiltersSnapshotSchema.parse(filters), filters);
  assert.deepEqual(
    recordSearchEventSchema.parse(recordOperation.payload),
    recordOperation.payload,
  );

  assert.throws(() =>
    searchFiltersSnapshotSchema.parse({ ...filters, unexpected: "value" }),
  );
  assert.throws(() =>
    recordSearchEventSchema.parse({
      ...recordOperation.payload,
      query: "x".repeat(201),
    }),
  );
  assert.throws(() =>
    recordSearchEventSchema.parse({
      ...recordOperation.payload,
      query: "different query",
    }),
  );

  assert.deepEqual(
    recordSearchEventSchema.parse({
      ...recordOperation.payload,
      query: "",
      filters: { ...filters, search: "" },
      trigger: "filter_change",
    }).query,
    "",
  );
  assert.deepEqual(
    recordSearchEventSchema.parse({
      ...recordOperation.payload,
      query: "",
      filters: { ...filters, search: "" },
      trigger: "search_commit",
    }).trigger,
    "search_commit",
  );
});

test("normalized Unicode query keys can expand beyond the input limit", () => {
  const query = "İ".repeat(200);
  const parsed = recordSearchEventSchema.parse({
    ...recordOperation.payload,
    query,
    filters: { ...recordOperation.payload.filters, search: query },
  });

  assert.equal(parsed.query.length, 200);
  assert.equal(getSearchHistoryQueryKey(parsed.query).length, 400);
});

test("search history deletion carries one stable id and client cutoff", () => {
  const deletion = {
    operationId: "bf274cea-412b-4cf8-963f-283ae527d676",
    expectedUserId: 42,
    scope: "contracts" as const,
    query: "telegram bot",
    clientDeletedAt: "2026-08-30T12:05:00.000Z",
  };

  assert.deepEqual(deleteSearchHistorySchema.parse(deletion), deletion);
  assert.throws(() =>
    deleteSearchHistorySchema.parse({ ...deletion, operationId: "invalid" }),
  );
});

test("server history projection preserves times and deduplicates newest-first", () => {
  const items = buildSearchHistoryItems([
    {
      query: "",
      clientSearchedAt: "2026-08-30T12:04:00.000Z",
      createdAt: "2026-08-30T12:04:01.000Z",
    },
    {
      query: " Telegram Bot ",
      clientSearchedAt: "2026-08-30T12:03:00.000Z",
      createdAt: "2026-08-30T12:03:01.000Z",
    },
    {
      query: "telegram BOT",
      clientSearchedAt: "2026-08-30T12:02:00.000Z",
      createdAt: "2026-08-30T12:02:01.000Z",
    },
    {
      query: "Design",
      clientSearchedAt: "2026-08-30T12:01:00.000Z",
      createdAt: "2026-08-30T12:01:01.000Z",
    },
  ]);

  assert.deepEqual(items, [
    {
      query: "Telegram Bot",
      searchedAt: "2026-08-30T12:03:01.000Z",
      clientSearchedAt: "2026-08-30T12:03:00.000Z",
    },
    {
      query: "Design",
      searchedAt: "2026-08-30T12:01:01.000Z",
      clientSearchedAt: "2026-08-30T12:01:00.000Z",
    },
  ]);
});

test("history deletion suppresses only stale committed searches", () => {
  const deletedAt = "2026-08-30T12:00:00.000Z";

  assert.equal(
    isSearchEventSuppressedByDeletion(
      "search_commit",
      "2026-08-30T11:59:59.000Z",
      deletedAt,
    ),
    true,
  );
  assert.equal(
    isSearchEventSuppressedByDeletion(
      "search_commit",
      "2026-08-30T12:00:01.000Z",
      deletedAt,
    ),
    false,
  );
  assert.equal(
    isSearchEventSuppressedByDeletion(
      "filter_change",
      "2026-08-30T11:59:59.000Z",
      deletedAt,
    ),
    false,
  );
});

test("server ordering preserves offline times but clamps future client clocks", () => {
  const serverNow = new Date("2026-08-30T12:00:00.000Z");

  assert.equal(
    getEffectiveClientTimestamp(
      "2026-08-29T12:00:00.000Z",
      serverNow,
    ).toISOString(),
    "2026-08-29T12:00:00.000Z",
  );
  assert.equal(
    getEffectiveClientTimestamp(
      "2030-01-01T00:00:00.000Z",
      serverNow,
    ).toISOString(),
    serverNow.toISOString(),
  );
});

test("search history outbox round-trips idempotent records and rejects corruption", () => {
  assert.deepEqual(
    parseSearchHistoryOutbox(
      serializeSearchHistoryOutbox([recordOperation, deleteOperation]),
    ),
    [recordOperation, deleteOperation],
  );
  assert.deepEqual(parseSearchHistoryOutbox("{not-json"), []);
  assert.deepEqual(
    parseSearchHistoryOutbox(
      JSON.stringify({
        version: 1,
        operations: [
          { ...recordOperation, id: "not-a-uuid" },
          recordOperation,
        ],
      }),
    ),
    [recordOperation],
  );

  const legacyPayload: Partial<typeof recordOperation.payload> = {
    ...recordOperation.payload,
  };
  delete legacyPayload.trigger;
  const parsedLegacyOperations = parseSearchHistoryOutbox(
    JSON.stringify({
      version: 1,
      operations: [{ ...recordOperation, payload: legacyPayload }],
    }),
  );
  assert.equal(
    parsedLegacyOperations[0]?.kind,
    "record",
  );
  if (parsedLegacyOperations[0]?.kind === "record") {
    assert.equal(parsedLegacyOperations[0].payload.trigger, "search_commit");
  }

  assert.deepEqual(
    parseSearchHistoryOutbox(
      JSON.stringify({
        version: 1,
        operations: [
          {
            ...deleteOperation,
            id: "1671a12f-d75e-4e93-a2e9-25ac61a6f9a0",
          },
          recordOperation,
        ],
      }),
    ),
    [recordOperation],
  );
});

test("search history outbox does not silently truncate long offline queues", () => {
  const operations = Array.from({ length: 250 }, (_, index) => {
    const suffix = String(index).padStart(12, "0");
    const eventId = `00000000-0000-4000-8000-${suffix}`;
    return {
      ...recordOperation,
      id: eventId,
      payload: { ...recordOperation.payload, eventId },
    } satisfies SearchHistoryOutboxOperation;
  });

  assert.equal(
    parseSearchHistoryOutbox(serializeSearchHistoryOutbox(operations)).length,
    operations.length,
  );
});

test("search history outbox keeps account operations isolated", () => {
  const anotherUserOperation: SearchHistoryOutboxOperation = {
    ...recordOperation,
    id: "bf274cea-412b-4cf8-963f-283ae527d676",
    payload: {
      ...recordOperation.payload,
      eventId: "bf274cea-412b-4cf8-963f-283ae527d676",
      expectedUserId: 7,
    },
  };

  assert.deepEqual(
    getSearchHistoryOutboxOperationsForUser(
      [recordOperation, anotherUserOperation],
      42,
    ),
    [recordOperation],
  );
  assert.deepEqual(
    getSearchHistoryOutboxOperationsForUser(
      [recordOperation, anotherUserOperation],
      7,
    ),
    [anotherUserOperation],
  );
});
