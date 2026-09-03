import assert from "node:assert/strict";
import test from "node:test";

import {
  isClaimedScoutContract,
  isUnclaimedScoutContract,
} from "../../src/entities/contract/model/scouting";

test("a scout-owned contract stays direct-pay before it is claimed", () => {
  assert.equal(
    isUnclaimedScoutContract({
      authorId: 10,
      scoutId: 10,
    }),
    true,
  );
});

test("a claimed scout contract can enable escrow while preserving its scout", () => {
  assert.equal(
    isUnclaimedScoutContract({
      authorId: 20,
      scoutId: 10,
    }),
    false,
  );
  assert.equal(
    isClaimedScoutContract({
      authorId: 20,
      scoutId: 10,
    }),
    true,
  );
});

test("a regular contract is not treated as an unclaimed scout contract", () => {
  assert.equal(
    isUnclaimedScoutContract({
      authorId: 20,
      scoutId: null,
    }),
    false,
  );
  assert.equal(
    isClaimedScoutContract({
      authorId: 20,
      scoutId: null,
    }),
    false,
  );
});
