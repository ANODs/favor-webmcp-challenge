import assert from "node:assert/strict";
import test from "node:test";

import {
  buildContractManagementWriteWhere,
  canManageContract,
  canViewContractAuthorContact,
} from "../../src/entities/contract/model/scouting";

const claimedContract = {
  authorId: 10,
  scoutId: 20,
};

test("only the current author or a moderator can mutate a claimed contract", () => {
  assert.equal(
    canManageContract(claimedContract, { id: claimedContract.authorId }),
    true,
  );
  assert.equal(
    canManageContract(claimedContract, {
      id: 30,
      role: "moderator",
    }),
    true,
  );
  assert.equal(
    canManageContract(claimedContract, { id: claimedContract.scoutId }),
    false,
  );
  assert.equal(canManageContract(claimedContract, { id: 30 }), false);
  assert.equal(canManageContract(claimedContract, null), false);
});

test("the scout can manage an unclaimed contract only because they are its author", () => {
  const unclaimedContract = {
    authorId: 20,
    scoutId: 20,
  };

  assert.equal(
    canManageContract(unclaimedContract, { id: unclaimedContract.scoutId }),
    true,
  );
});

test("database mutations keep current author ownership in the write predicate", () => {
  assert.deepEqual(buildContractManagementWriteWhere(42, { id: 20 }), {
    id: 42,
    authorId: 20,
  });
  assert.deepEqual(
    buildContractManagementWriteWhere(42, {
      id: 30,
      role: "moderator",
    }),
    { id: 42 },
  );
});

test("a post-claim scout keeps no implicit access to the new author's contact", () => {
  assert.equal(
    canViewContractAuthorContact(claimedContract, {
      id: claimedContract.scoutId,
    }),
    false,
  );
  assert.equal(
    canViewContractAuthorContact(claimedContract, {
      id: claimedContract.authorId,
    }),
    true,
  );
  assert.equal(
    canViewContractAuthorContact(claimedContract, {
      id: 30,
      role: "moderator",
    }),
    true,
  );
  assert.equal(
    canViewContractAuthorContact(claimedContract, {
      id: 30,
      isPremium: true,
    }),
    true,
  );
  assert.equal(
    canViewContractAuthorContact(claimedContract, { id: 30 }, true),
    true,
  );
});
