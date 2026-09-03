import assert from "node:assert/strict";
import test from "node:test";

import {
  contractInputSchema,
  contractUpdateSchema,
} from "../../src/entities/contract/model/schema";

const baseContract = {
  titleRu: "Нужен разработчик",
  descriptionRu: "Нужен разработчик для долгосрочного проекта.",
  type: "order" as const,
};

test("scouted Telegram username is normalized to a direct lowercase username", () => {
  const result = contractInputSchema.parse({
    ...baseContract,
    scoutedTelegramUsername: "  @Source_Author  ",
  });

  assert.equal(result.scoutedTelegramUsername, "source_author");
});

test("scouted Telegram username keeps nullable and omitted legacy inputs compatible", () => {
  assert.equal(
    contractInputSchema.parse({
      ...baseContract,
      scoutedTelegramUsername: null,
    }).scoutedTelegramUsername,
    null,
  );
  assert.equal(
    contractInputSchema.parse(baseContract).scoutedTelegramUsername,
    undefined,
  );
});

test("scouted Telegram username is create-only and is stripped from public updates", () => {
  const result = contractUpdateSchema.parse({
    scoutedTelegramUsername: "replacement_author",
    contractId: 42,
    baseUpdatedAt: "2026-08-27T10:00:00.000Z",
  });

  assert.equal("scoutedTelegramUsername" in result, false);
});

test("scouted Telegram username rejects links and malformed handles", () => {
  for (const scoutedTelegramUsername of [
    "https://t.me/source_author",
    "source author",
    "12345",
    "@abc",
  ]) {
    assert.equal(
      contractInputSchema.safeParse({
        ...baseContract,
        scoutedTelegramUsername,
      }).success,
      false,
    );
  }
});
