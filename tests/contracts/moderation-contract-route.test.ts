import assert from "node:assert/strict";
import test from "node:test";

import { GET } from "../../src/app/api/moderation/contracts/route";
import { contractsClient } from "../../src/entities/contract/api/contracts-client";
import {
  encodeContractModerationCursor,
  paginateContractModerationResults,
  parseContractModerationCursor,
  type ContractModerationCandidate,
} from "../../src/features/contract-ai-moderation/server/moderation-pagination";

const originalFetch = globalThis.fetch;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("moderation contract client calls the protected feed scope on the current origin", async () => {
  let requestPath = "";
  globalThis.fetch = (async (input) => {
    requestPath = String(input);
    return new Response(
      JSON.stringify({ ok: true, data: { items: [], nextCursor: null } }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }) as typeof fetch;

  await contractsClient.getModerationList(
    { status: "archived", sortOrder: "asc" },
    "cursor-value",
  );

  assert.match(requestPath, /^\/api\/contracts\?/u);
  assert.doesNotMatch(requestPath, /(?:https?:\/\/|0\.0\.0\.0)/u);
  const requestUrl = new URL(requestPath, "https://favor.test");
  assert.equal(requestUrl.pathname, "/api/contracts");
  assert.equal(requestUrl.searchParams.get("moderation"), "true");
  assert.equal(requestUrl.searchParams.get("status"), "archived");
  assert.equal(requestUrl.searchParams.get("sortOrder"), "asc");
  assert.equal(requestUrl.searchParams.get("cursor"), "cursor-value");
});

test("legacy moderation contract endpoint redirects only within the current origin", () => {
  const response = GET(
    new Request(
      "https://0.0.0.0:3000/api/moderation/contracts?status=archived&cursor=42",
    ),
  );
  const location = response.headers.get("location") ?? "";

  assert.equal(response.status, 307);
  assert.match(location, /^\/api\/contracts\?/u);
  assert.doesNotMatch(location, /(?:https?:\/\/|0\.0\.0\.0)/u);
  assert.equal(response.headers.get("cache-control"), "no-store");

  const redirectUrl = new URL(location, "https://favor.test");
  assert.equal(redirectUrl.searchParams.get("moderation"), "true");
  assert.equal(redirectUrl.searchParams.get("status"), "archived");
  assert.equal(redirectUrl.searchParams.get("cursor"), "42");
});

test("moderation cursors carry a complete self-contained sort boundary", () => {
  const candidate: ContractModerationCandidate = {
    kind: "price",
    id: 42,
    createdAt: new Date("2026-08-31T10:00:00.000Z"),
    basePrice: "125.50",
  };
  const cursor = encodeContractModerationCursor(candidate, "desc");

  assert.deepEqual(parseContractModerationCursor(cursor, "price", "desc"), {
    version: 1,
    sort: "price",
    order: "desc",
    id: 42,
    createdAt: "2026-08-31T10:00:00.000Z",
    basePrice: "125.50",
  });
  assert.throws(() =>
    parseContractModerationCursor(cursor, "price", "asc"),
  );
  assert.throws(() =>
    parseContractModerationCursor("not-a-cursor", "price", "desc"),
  );
  const invalidPriceCursor = Buffer.from(JSON.stringify({
    version: 1,
    sort: "price",
    order: "desc",
    id: 42,
    createdAt: "0",
    basePrice: " ",
  })).toString("base64url");
  assert.throws(() =>
    parseContractModerationCursor(invalidPriceCursor, "price", "desc"),
  );
  assert.throws(() =>
    parseContractModerationCursor(`${cursor}!`, "price", "desc"),
  );
});

test("rating scans continue after the last inspected candidate", () => {
  const candidates: ContractModerationCandidate[] = [1, 2, 3].map((id) => ({
    kind: "createdAt",
    id,
    createdAt: new Date(`2026-08-31T10:00:0${id}.000Z`),
  }));
  const page = paginateContractModerationResults(
    [],
    candidates,
    true,
    "asc",
    2,
  );

  assert.deepEqual(page.items, []);
  assert.equal(
    parseContractModerationCursor(
      page.nextCursor,
      "createdAt",
      "asc",
    )?.id,
    3,
  );
});

test("a full filtered page resumes after its last returned item", () => {
  const candidates: ContractModerationCandidate[] = [1, 2, 3, 4].map(
    (id) => ({
      kind: "deals-positive",
      id,
      openDealsCount: 10 - id,
    }),
  );
  const page = paginateContractModerationResults(
    [{ id: 1 }, { id: 3 }, { id: 4 }],
    candidates,
    false,
    "desc",
    2,
  );

  assert.deepEqual(page.items, [{ id: 1 }, { id: 3 }]);
  assert.equal(
    parseContractModerationCursor(
      page.nextCursor,
      "deals",
      "desc",
    )?.id,
    3,
  );
});
