import assert from "node:assert/strict";
import test from "node:test";

import {
  reconcileContractMediaRefs,
  setPrimaryContractMediaRef,
  toggleContractMediaRef,
} from "../../src/entities/contract/model/media";
import { getContractGradientStyle } from "../../src/entities/contract/model/visual";

test("setting the primary contract image moves it to the first position", () => {
  assert.deepEqual(setPrimaryContractMediaRef(["one", "two", "three"], "three"), [
    "three",
    "one",
    "two",
  ]);
});

test("setting an unselected image as primary selects it without duplicates", () => {
  assert.deepEqual(setPrimaryContractMediaRef(["one", "two"], "three"), [
    "three",
    "one",
    "two",
  ]);
});

test("toggling media removes a selected image and appends a new one", () => {
  assert.deepEqual(toggleContractMediaRef(["one", "two"], "one"), ["two"]);
  assert.deepEqual(toggleContractMediaRef(["one"], "two"), ["one", "two"]);
});

test("refreshing Telegram media keeps the primary image and explicit deselections", () => {
  assert.deepEqual(
    reconcileContractMediaRefs(["two"], ["one", "two"], ["one", "two", "three"]),
    ["two", "three"],
  );
});

test("contract fallback gradient is stable and uses four light sources", () => {
  const first = getContractGradientStyle("contract-slug");
  const second = getContractGradientStyle("contract-slug");

  assert.deepEqual(first, second);
  assert.equal(first.backgroundImage.match(/radial-gradient/g)?.length, 4);
});
