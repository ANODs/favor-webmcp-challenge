import assert from "node:assert/strict";
import test from "node:test";

import {
  initiateContractDealWithServerDependencies,
  type InitiateContractDealServerDependencies,
  type InitiateContractDealServerInput,
} from "../../src/features/initiate-contract-deal/server/initiate-contract-deal-server";

const input: InitiateContractDealServerInput = {
  slug: "test-contract",
  userId: 20,
  telegramUserId: 200n,
  payload: { details: "Готов выполнить задачу" },
};

const makeDependencies = (
  overrides: Partial<InitiateContractDealServerDependencies<string>> = {},
) => {
  let initiateCalls = 0;
  let initiatedExpectedAuthorId: number | undefined;

  const dependencies: InitiateContractDealServerDependencies<string> = {
    findContractAuthorTelegramIdentity: async () => ({
      userId: 10,
      telegramUserId: 100n,
    }),
    assertTelegramBotWriteAccess: async () => undefined,
    initiate: async (initiateInput) => {
      initiateCalls += 1;
      initiatedExpectedAuthorId = initiateInput.expectedAuthorId;
      return "created";
    },
    ...overrides,
  };

  return {
    dependencies,
    getInitiateCalls: () => initiateCalls,
    getInitiatedExpectedAuthorId: () => initiatedExpectedAuthorId,
  };
};

test("deal initiation checks the actor and author before persistence", async () => {
  const checked: Array<[bigint, string | undefined]> = [];
  const fixture = makeDependencies({
    assertTelegramBotWriteAccess: async (telegramUserId, subject) => {
      checked.push([telegramUserId, subject]);
    },
  });

  const result = await initiateContractDealWithServerDependencies(
    input,
    fixture.dependencies,
  );

  assert.equal(result, "created");
  assert.deepEqual(checked, [
    [200n, undefined],
    [100n, "contract_author"],
  ]);
  assert.equal(fixture.getInitiateCalls(), 1);
  assert.equal(fixture.getInitiatedExpectedAuthorId(), 10);
});

test("an actor without bot access prevents all deal writes", async () => {
  const accessError = new Error("actor chat unavailable");
  const fixture = makeDependencies({
    assertTelegramBotWriteAccess: async (telegramUserId) => {
      if (telegramUserId === input.telegramUserId) {
        throw accessError;
      }
    },
  });

  await assert.rejects(
    initiateContractDealWithServerDependencies(input, fixture.dependencies),
    accessError,
  );
  assert.equal(fixture.getInitiateCalls(), 0);
});

test("an author without bot access prevents all deal writes", async () => {
  const accessError = new Error("author chat unavailable");
  const fixture = makeDependencies({
    assertTelegramBotWriteAccess: async (_telegramUserId, subject) => {
      if (subject === "contract_author") {
        throw accessError;
      }
    },
  });

  await assert.rejects(
    initiateContractDealWithServerDependencies(input, fixture.dependencies),
    accessError,
  );
  assert.equal(fixture.getInitiateCalls(), 0);
});

test("actor access error takes priority when both Telegram checks fail", async () => {
  const actorAccessError = new Error("actor chat unavailable");
  const authorAccessError = new Error("author chat unavailable");
  const fixture = makeDependencies({
    assertTelegramBotWriteAccess: async (_telegramUserId, subject) => {
      throw subject === "contract_author"
        ? authorAccessError
        : actorAccessError;
    },
  });

  await assert.rejects(
    initiateContractDealWithServerDependencies(input, fixture.dependencies),
    actorAccessError,
  );
  assert.equal(fixture.getInitiateCalls(), 0);
});

test("a missing contract fails before access checks and persistence", async () => {
  let accessChecks = 0;
  const fixture = makeDependencies({
    findContractAuthorTelegramIdentity: async () => null,
    assertTelegramBotWriteAccess: async () => {
      accessChecks += 1;
    },
  });

  await assert.rejects(
    initiateContractDealWithServerDependencies(input, fixture.dependencies),
    /NOT_FOUND/,
  );
  assert.equal(accessChecks, 0);
  assert.equal(fixture.getInitiateCalls(), 0);
});

test("self-initiation probes the shared chat only once", async () => {
  let accessChecks = 0;
  const fixture = makeDependencies({
    findContractAuthorTelegramIdentity: async () => ({
      userId: input.userId,
      telegramUserId: input.telegramUserId,
    }),
    assertTelegramBotWriteAccess: async () => {
      accessChecks += 1;
    },
  });

  await initiateContractDealWithServerDependencies(input, fixture.dependencies);

  assert.equal(accessChecks, 1);
});
