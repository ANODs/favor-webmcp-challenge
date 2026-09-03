import assert from "node:assert/strict";
import test from "node:test";
import { type Prisma, Role } from "@prisma/client";

import {
  claimScoutedContractAuthor,
  ContractClaimConflictError,
  ContractClaimLimitError,
} from "../../src/entities/contract/server/scouted-contract-claim";

type ContractUpdateManyArgs = Parameters<
  Prisma.TransactionClient["contract"]["updateMany"]
>[0];

const claimInput = {
  contractId: 42,
  scoutId: 20,
  claimantId: 30,
  claimantIsPremium: false,
  claimantRole: Role.customer,
};

test("claim uses the original active scout ownership as a compare-and-swap guard", async () => {
  let updateArgs: ContractUpdateManyArgs | undefined;
  let countArgs: unknown;
  let lockQuery = "";
  const operationOrder: string[] = [];
  const updatedContract = {
    id: claimInput.contractId,
    authorId: claimInput.claimantId,
    scoutId: claimInput.scoutId,
  };
  const tx = {
    $queryRaw: async (query: TemplateStringsArray) => {
      lockQuery = query.join("?");
      operationOrder.push("lock");
      return [{ lock: "" }];
    },
    contract: {
      count: async (args: unknown) => {
        countArgs = args;
        operationOrder.push("count");
        return 0;
      },
      updateMany: async (args: ContractUpdateManyArgs) => {
        updateArgs = args;
        operationOrder.push("update");
        return { count: 1 };
      },
      findUniqueOrThrow: async () => {
        operationOrder.push("read");
        return updatedContract;
      },
    },
  } as unknown as Prisma.TransactionClient;

  const result = await claimScoutedContractAuthor(tx, claimInput);

  assert.deepEqual(updateArgs, {
    where: {
      id: claimInput.contractId,
      status: "active",
      authorId: claimInput.scoutId,
      scoutId: claimInput.scoutId,
    },
    data: { authorId: claimInput.claimantId },
  });
  assert.match(lockQuery, /pg_advisory_xact_lock/);
  assert.deepEqual(countArgs, {
    where: {
      authorId: claimInput.claimantId,
      OR: [
        { scoutId: null },
        { scoutId: { not: claimInput.claimantId } },
      ],
      status: { notIn: ["archived", "rejected"] },
    },
  });
  assert.deepEqual(operationOrder, ["lock", "count", "update", "read"]);
  assert.deepEqual(result, updatedContract);
});

test("a stale concurrent claimant loses without reading or overwriting the winner", async () => {
  let readAfterClaim = false;
  const tx = {
    $queryRaw: async () => [{ lock: "" }],
    contract: {
      count: async () => 0,
      updateMany: async () => ({ count: 0 }),
      findUniqueOrThrow: async () => {
        readAfterClaim = true;
        return null;
      },
    },
  } as unknown as Prisma.TransactionClient;

  await assert.rejects(
    () => claimScoutedContractAuthor(tx, claimInput),
    ContractClaimConflictError,
  );
  assert.equal(readAfterClaim, false);
});

test("claim stops before ownership changes when the serialized user limit is full", async () => {
  let updateAttempted = false;
  const tx = {
    $queryRaw: async () => [{ lock: "" }],
    contract: {
      count: async () => 1,
      updateMany: async () => {
        updateAttempted = true;
        return { count: 1 };
      },
    },
  } as unknown as Prisma.TransactionClient;

  await assert.rejects(
    () => claimScoutedContractAuthor(tx, claimInput),
    ContractClaimLimitError,
  );
  assert.equal(updateAttempted, false);
});

test("different-contract claims for one free user serialize against one quota", async () => {
  let activeContractCount = 0;
  let lockTail = Promise.resolve();

  const makeTransaction = (contractId: number) => {
    let releaseLock: (() => void) | undefined;
    const tx = {
      $queryRaw: async () => {
        const previousLock = lockTail;
        lockTail = new Promise<void>((resolve) => {
          releaseLock = resolve;
        });
        await previousLock;
        return [{ lock: "" }];
      },
      contract: {
        count: async () => activeContractCount,
        updateMany: async () => {
          activeContractCount += 1;
          return { count: 1 };
        },
        findUniqueOrThrow: async () => ({
          id: contractId,
          authorId: claimInput.claimantId,
          scoutId: claimInput.scoutId,
        }),
      },
    } as unknown as Prisma.TransactionClient;

    return {
      tx,
      release: () => releaseLock?.(),
    };
  };

  const first = makeTransaction(42);
  const second = makeTransaction(43);
  const runClaim = async (
    transaction: ReturnType<typeof makeTransaction>,
    contractId: number,
  ) => {
    try {
      return await claimScoutedContractAuthor(transaction.tx, {
        ...claimInput,
        contractId,
      });
    } finally {
      transaction.release();
    }
  };

  const results = await Promise.allSettled([
    runClaim(first, 42),
    runClaim(second, 43),
  ]);

  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  const rejected = results.find((result) => result.status === "rejected");
  assert.ok(rejected && rejected.status === "rejected");
  assert.ok(rejected.reason instanceof ContractClaimLimitError);
  assert.equal(activeContractCount, 1);
});
