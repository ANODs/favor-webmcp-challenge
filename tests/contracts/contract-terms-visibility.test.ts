import assert from "node:assert/strict";
import test from "node:test";

import { getContractTermsVisibility } from "../../src/entities/contract/model/presentation";

test("hides contract terms when price and deadline are not specified", () => {
  assert.deepEqual(
    getContractTermsVisibility({ basePrice: null, deadlineDays: null }),
    {
      hasPrice: false,
      hasDeadline: false,
      hasTerms: false,
    },
  );
});

test("shows only the specified contract term", () => {
  assert.deepEqual(
    getContractTermsVisibility({ basePrice: 100, deadlineDays: null }),
    {
      hasPrice: true,
      hasDeadline: false,
      hasTerms: true,
    },
  );
  assert.deepEqual(
    getContractTermsVisibility({ basePrice: null, deadlineDays: 7 }),
    {
      hasPrice: false,
      hasDeadline: true,
      hasTerms: true,
    },
  );
});

test("shows both contract terms when both are specified", () => {
  assert.deepEqual(
    getContractTermsVisibility({ basePrice: 0, deadlineDays: 7 }),
    {
      hasPrice: true,
      hasDeadline: true,
      hasTerms: true,
    },
  );
});
