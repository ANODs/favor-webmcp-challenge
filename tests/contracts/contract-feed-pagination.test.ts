import assert from "node:assert/strict";
import test from "node:test";

import {
  CONTRACT_FEED_PAGE_SIZE,
  paginateContractFeed,
  parseContractFeedCursor,
} from "../../src/entities/contract/model/feed-pagination";

const contracts = Array.from({ length: CONTRACT_FEED_PAGE_SIZE * 2 + 1 }, (_, index) => ({
  id: 100 - index,
}));

test("contract feed returns bounded pages and continues after a stable contract cursor", () => {
  const firstPage = paginateContractFeed(contracts);
  const secondPage = paginateContractFeed(
    contracts,
    parseContractFeedCursor(firstPage.nextCursor),
  );

  assert.equal(firstPage.items.length, CONTRACT_FEED_PAGE_SIZE);
  assert.equal(firstPage.nextCursor, String(firstPage.items.at(-1)?.id));
  assert.equal(secondPage.items.length, CONTRACT_FEED_PAGE_SIZE);
  assert.deepEqual(
    secondPage.items.map(({ id }) => id),
    contracts.slice(CONTRACT_FEED_PAGE_SIZE, CONTRACT_FEED_PAGE_SIZE * 2).map(({ id }) => id),
  );
  assert.equal(secondPage.nextCursor, String(secondPage.items.at(-1)?.id));
});

test("contract feed closes pagination on the final partial page", () => {
  const finalPage = paginateContractFeed(
    contracts,
    contracts[CONTRACT_FEED_PAGE_SIZE * 2 - 1]?.id,
  );

  assert.deepEqual(finalPage.items, contracts.slice(CONTRACT_FEED_PAGE_SIZE * 2));
  assert.equal(finalPage.nextCursor, null);
});

test("contract feed rejects malformed and stale cursors", () => {
  assert.throws(() => parseContractFeedCursor("not-a-number"));
  assert.throws(() => parseContractFeedCursor("0"));
  assert.throws(() => paginateContractFeed(contracts, 999));
});
