import assert from "node:assert/strict";
import test from "node:test";

import type { PrismaClient } from "@prisma/client";

import { registerAppRelease } from "../../src/shared/lib/app-version/server";

test("keeps a commit version stable and increments only for a new commit", async () => {
  const releases: Array<{
    id: number;
    commitSha: string;
    patch: number;
    createdAt: Date;
  }> = [];
  let lockCount = 0;

  const transaction = {
    $queryRaw: async (query: TemplateStringsArray) => {
      assert.match(query.join("?"), /pg_advisory_xact_lock\(.+\)::text/);
      lockCount += 1;
      return [{ lock: "" }];
    },
    appRelease: {
      findUnique: async ({ where }: { where: { commitSha: string } }) =>
        releases.find((release) => release.commitSha === where.commitSha) ?? null,
      findFirst: async () => {
        const latestRelease = releases.toSorted((left, right) => right.patch - left.patch)[0];
        return latestRelease ? { patch: latestRelease.patch } : null;
      },
      create: async ({ data }: { data: { commitSha: string; patch: number } }) => {
        const release = {
          id: releases.length + 1,
          commitSha: data.commitSha,
          patch: data.patch,
          createdAt: new Date(),
        };
        releases.push(release);
        return release;
      },
    },
  };
  const database = {
    $transaction: async (callback: (client: typeof transaction) => unknown) =>
      callback(transaction),
  } as unknown as PrismaClient;
  const firstCommitSha = "a".repeat(40);
  const secondCommitSha = "b".repeat(40);

  const firstRelease = await registerAppRelease(database, firstCommitSha);
  const restartedRelease = await registerAppRelease(database, firstCommitSha);
  const secondRelease = await registerAppRelease(database, secondCommitSha);

  assert.equal(firstRelease.patch, 0);
  assert.equal(restartedRelease.patch, 0);
  assert.equal(secondRelease.patch, 1);
  assert.equal(releases.length, 2);
  assert.equal(lockCount, 3);
});
