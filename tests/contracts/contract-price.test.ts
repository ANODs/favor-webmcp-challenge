import assert from "node:assert/strict";
import test from "node:test";

import { contractInputSchema } from "../../src/entities/contract/model/schema";
import {
  CONTRACT_PRICE_MAX_USD,
  CONTRACT_PRICE_STEP_USD,
} from "../../src/shared/config";

const baseContract = {
  titleEn: "Landing page design",
  descriptionEn: "I will design a landing page and provide source files.",
  type: "offer" as const,
};

test("contract prices fit the persisted USD decimal", () => {
  assert.equal(
    contractInputSchema.safeParse({
      ...baseContract,
      basePrice: CONTRACT_PRICE_MAX_USD,
    }).success,
    true,
  );
  assert.equal(
    contractInputSchema.safeParse({
      ...baseContract,
      basePrice: CONTRACT_PRICE_MAX_USD + CONTRACT_PRICE_STEP_USD,
    }).success,
    false,
  );
  assert.equal(
    contractInputSchema.safeParse({
      ...baseContract,
      basePrice: 10.001,
    }).success,
    false,
  );
});
