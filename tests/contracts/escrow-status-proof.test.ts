import assert from "node:assert/strict";
import test from "node:test";

import {
  ESCROW_STATUS_REFUNDED,
  getEscrowReleaseProofWithDependencies,
} from "../../src/shared/lib/ton/escrow-status.server";

test("a live refunded contract is recognized by its status getter", async () => {
  const proof = await getEscrowReleaseProofWithDependencies({
    getStatus: async () => ESCROW_STATUS_REFUNDED,
    getSettlementCommands: async () => new Set(),
  });

  assert.deepEqual(proof, {
    released: false,
    refunded: true,
    status: ESCROW_STATUS_REFUNDED,
  });
});

test("a destroyed refunded contract is recovered from its successful event", async () => {
  const proof = await getEscrowReleaseProofWithDependencies({
    getStatus: async () => {
      throw new Error("contract is not active");
    },
    getSettlementCommands: async () => new Set(["refund"] as const),
  });

  assert.deepEqual(proof, {
    released: false,
    refunded: true,
    status: null,
  });
});

test("a getter failure without settlement evidence is not treated as a refund", async () => {
  const statusError = new Error("temporary TON provider failure");

  await assert.rejects(
    getEscrowReleaseProofWithDependencies({
      getStatus: async () => {
        throw statusError;
      },
      getSettlementCommands: async () => new Set(),
    }),
    (error: unknown) => error === statusError,
  );
});
