import assert from "node:assert/strict";
import test from "node:test";

import { Prisma, type Contract } from "@prisma/client";

import {
  rethrowContractManagementWriteError,
  serializeContractMutationResponse,
  withLockedManagedContract,
} from "../../src/entities/contract/server/managed-mutation";

const contract = {
  id: 42,
  authorId: 10,
  scoutId: 20,
  slug: "managed-contract",
} as Contract;

const createTransaction = ({
  currentContract = contract,
  events,
}: {
  currentContract?: Contract | null;
  events: string[];
}) =>
  ({
    $queryRaw: async () => {
      events.push("lock");
      return currentContract ? [{ id: currentContract.id }] : [];
    },
    contract: {
      findUnique: async () => {
        events.push("read");
        return currentContract;
      },
    },
  }) as unknown as Prisma.TransactionClient;

test("a fresh author check runs under the row lock before an external mutation", async () => {
  const events: string[] = [];
  const tx = createTransaction({ events });

  const result = await withLockedManagedContract(
    tx,
    { slug: contract.slug, user: { id: contract.authorId } },
    async () => {
      events.push("mutation");
      return "updated";
    },
  );

  assert.deepEqual(events, ["lock", "read", "mutation"]);
  assert.deepEqual(result, { status: "ok", data: "updated" });
});

test("a scout cannot run an external mutation after the contract was claimed", async () => {
  const events: string[] = [];
  const tx = createTransaction({ events });

  const result = await withLockedManagedContract(
    tx,
    { slug: contract.slug, user: { id: contract.scoutId as number } },
    async () => {
      events.push("mutation");
      return "updated";
    },
  );

  assert.deepEqual(events, ["lock", "read"]);
  assert.deepEqual(result, { status: "forbidden" });
});

test("moderators retain the explicit external mutation bypass", async () => {
  const events: string[] = [];
  const tx = createTransaction({ events });

  const result = await withLockedManagedContract(
    tx,
    { slug: contract.slug, user: { id: 30, role: "moderator" } },
    async () => {
      events.push("mutation");
      return "updated";
    },
  );

  assert.deepEqual(events, ["lock", "read", "mutation"]);
  assert.deepEqual(result, { status: "ok", data: "updated" });
});

test("mutation responses omit internal Telegram ids without mutating notification data", () => {
  const input = {
    id: contract.id,
    slug: contract.slug,
    author: { id: contract.authorId, telegramId: 42424241n },
    scout: { id: contract.scoutId, telegramId: 42424242n },
  };

  const result = serializeContractMutationResponse(input);

  assert.deepEqual(result, {
    id: contract.id,
    slug: contract.slug,
    author: { id: contract.authorId },
    scout: { id: contract.scoutId },
  });
  assert.equal(input.author.telegramId, 42424241n);
  assert.equal(input.scout.telegramId, 42424242n);
});

test("a conditional write miss is reported as lost management access", () => {
  const missingRecord = new Prisma.PrismaClientKnownRequestError(
    "Record to update not found",
    {
      code: "P2025",
      clientVersion: "test",
    },
  );

  assert.throws(
    () => rethrowContractManagementWriteError(missingRecord),
    /^Error: FORBIDDEN$/,
  );
});
