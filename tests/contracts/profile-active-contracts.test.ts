import assert from "node:assert/strict";
import test from "node:test";

import {
  buildActiveContractAuthorScope,
  contractQueryKeys,
  resolveActiveContractAuthorScope,
} from "../../src/entities/contract";

test("profile contract scope always restricts an author to active contracts", () => {
  assert.deepEqual(resolveActiveContractAuthorScope("42"), {
    authorId: 42,
    status: "active",
  });
  assert.deepEqual(buildActiveContractAuthorScope(42), {
    authorId: 42,
    status: "active",
  });
  assert.equal(resolveActiveContractAuthorScope(null), null);
});

test("profile contract scope rejects malformed author ids", () => {
  assert.throws(
    () => buildActiveContractAuthorScope(0),
    /INVALID_ACTIVE_CONTRACT_AUTHOR_ID/,
  );

  for (const authorId of ["", "0", "-1", "1.5", "author", "9007199254740992"]) {
    assert.throws(
      () => resolveActiveContractAuthorScope(authorId),
      /INVALID_ACTIVE_CONTRACT_AUTHOR_ID/,
    );
  }
});

test("profile contract queries are cached separately for each author", () => {
  const firstAuthorKey = contractQueryKeys.activeAuthorList(42, 3, "ru");
  const secondAuthorKey = contractQueryKeys.activeAuthorList(43, 3, "ru");

  assert.notDeepEqual(firstAuthorKey, secondAuthorKey);
});

test("profile contract queries refresh when the active count changes", () => {
  const previousKey = contractQueryKeys.activeAuthorList(42, 3, "ru");
  const updatedKey = contractQueryKeys.activeAuthorList(42, 4, "ru");

  assert.notDeepEqual(previousKey, updatedKey);
});

test("profile contract queries are cached separately for each locale", () => {
  const russianKey = contractQueryKeys.activeAuthorList(42, 3, "ru");
  const englishKey = contractQueryKeys.activeAuthorList(42, 3, "en");

  assert.notDeepEqual(russianKey, englishKey);
});
