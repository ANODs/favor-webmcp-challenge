import assert from "node:assert/strict";
import test from "node:test";

import { contractInputSchema } from "../../src/entities/contract/model/schema";
import { isStablecoinEscrowCurrency } from "../../src/shared/lib/ton/stablecoin";

const baseContract = {
  titleRu: "Тестовый контракт",
  descriptionRu: "Описание тестового контракта для проверки валют escrow.",
  type: "offer" as const,
};

test("contract input accepts GRAM (stored as TON) and official TON USDT escrow currencies", () => {
  assert.equal(contractInputSchema.safeParse({ ...baseContract, escrowCurrency: "TON" }).success, true);
  assert.equal(contractInputSchema.safeParse({ ...baseContract, escrowCurrency: "USDT" }).success, true);
  assert.equal(contractInputSchema.safeParse({ ...baseContract, escrowCurrency: "USDC" }).success, false);
});

test("only USDT is recognized as a supported stablecoin escrow", () => {
  assert.equal(isStablecoinEscrowCurrency("USDT"), true);
  assert.equal(isStablecoinEscrowCurrency("USDC"), false);
});
