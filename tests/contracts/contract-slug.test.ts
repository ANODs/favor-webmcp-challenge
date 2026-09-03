import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma } from "@prisma/client";

import { allocateUniqueContractSlug } from "../../src/entities/contract/server/slug";

test("contract slug allocation locks the base before choosing a suffix", async () => {
  const operationOrder: string[] = [];
  let lockQuery = "";

  const tx = {
    $queryRaw: async (query: TemplateStringsArray) => {
      lockQuery = query.join("?");
      operationOrder.push("lock");
      return [{ lock: "" }];
    },
    contract: {
      findMany: async () => {
        operationOrder.push("read");
        return [
          { slug: "trebuetsya-dizainer" },
          { slug: "trebuetsya-dizainer-2" },
        ];
      },
    },
  } as unknown as Prisma.TransactionClient;

  const result = await allocateUniqueContractSlug(
    tx,
    "Требуется дизайнер",
  );

  assert.deepEqual(operationOrder, ["lock", "read"]);
  assert.match(lockQuery, /pg_advisory_xact_lock/);
  assert.doesNotMatch(lockQuery, /hashtext/);
  assert.deepEqual(result, {
    ok: true,
    slug: "trebuetsya-dizainer-3",
  });
});

test("contract slug allocation preserves the unsuffixed slug when available", async () => {
  const tx = {
    $queryRaw: async () => [{ lock: "" }],
    contract: {
      findMany: async () => [],
    },
  } as unknown as Prisma.TransactionClient;

  const result = await allocateUniqueContractSlug(tx, "Нужен разработчик");

  assert.deepEqual(result, {
    ok: true,
    slug: "nuzhen-razrabotchik",
  });
});
