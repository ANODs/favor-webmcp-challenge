import assert from "node:assert/strict";
import test from "node:test";

import {
  getContractVersionConflictDetails,
  parseContractVersionConflictDetails,
} from "../../src/entities/contract/model/version-conflict";

test("a concurrent slug change is recovered through the stable contract id", () => {
  const details = getContractVersionConflictDetails(
    {
      contractId: 42,
      slug: "old-contract-slug",
      baseUpdatedAt: "2026-08-27T10:00:00.000Z",
    },
    {
      id: 42,
      slug: "current-contract-slug",
      updatedAt: new Date("2026-08-27T10:05:00.000Z"),
    },
  );

  assert.deepEqual(details, {
    contractId: 42,
    slug: "current-contract-slug",
    updatedAt: "2026-08-27T10:05:00.000Z",
  });
  assert.deepEqual(
    parseContractVersionConflictDetails({
      code: "CONTRACT_VERSION_CONFLICT",
      ...details,
    }),
    details,
  );
});

test("the matching contract slug and revision can proceed", () => {
  assert.equal(
    getContractVersionConflictDetails(
      {
        contractId: 42,
        slug: "current-contract-slug",
        baseUpdatedAt: "2026-08-27T10:05:00.000Z",
      },
      {
        id: 42,
        slug: "current-contract-slug",
        updatedAt: "2026-08-27T10:05:00.000Z",
      },
    ),
    null,
  );
});
