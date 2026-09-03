import assert from "node:assert/strict";
import test from "node:test";

import {
  MODERATED_USERS_PAGE_SIZE,
  paginateModeratedUsers,
  parseModeratedUsersCursor,
} from "../../src/entities/user/model/moderation-pagination";

test("moderated users return a bounded page with a continuation cursor", () => {
  const records = Array.from(
    { length: MODERATED_USERS_PAGE_SIZE + 1 },
    (_, index) => ({
      id: 100 - index,
      createdAt: new Date(1_800_000_000_000 - index * 1_000),
    }),
  );

  const page = paginateModeratedUsers(records);

  assert.equal(page.items.length, MODERATED_USERS_PAGE_SIZE);
  const lastItem = page.items.at(-1);
  assert.equal(
    page.nextCursor,
    lastItem
      ? `v1.${lastItem.createdAt.getTime()}.${lastItem.id}`
      : null,
  );
});

test("moderated users close pagination on the final page", () => {
  const records = [3, 2, 1].map((id) => ({
    id,
    createdAt: new Date(1_800_000_000_000 + id),
  }));

  assert.deepEqual(paginateModeratedUsers(records), {
    items: records,
    nextCursor: null,
  });
});

test("moderated users reject malformed cursors", () => {
  assert.equal(parseModeratedUsersCursor(null), undefined);
  assert.deepEqual(parseModeratedUsersCursor("v1.1800000000000.42"), {
    createdAt: new Date(1_800_000_000_000),
    id: 42,
  });
  assert.throws(() => parseModeratedUsersCursor("not-a-number"));
  assert.throws(() => parseModeratedUsersCursor("0"));
  assert.throws(() => parseModeratedUsersCursor("1.5"));
});
