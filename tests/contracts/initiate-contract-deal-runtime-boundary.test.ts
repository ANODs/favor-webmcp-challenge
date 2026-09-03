import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const readSource = (path: string) => readFileSync(path, "utf8");

test("the initiate route imports schema only through the server entry", () => {
  const routeSource = readSource(
    "src/app/api/contracts/[slug]/initiate/route.ts",
  );
  const serverEntrySource = readSource(
    "src/features/initiate-contract-deal/server.ts",
  );
  const clientEntrySource = readSource(
    "src/features/initiate-contract-deal/index.ts",
  );

  assert.doesNotMatch(
    routeSource,
    /from "@\/features\/initiate-contract-deal"/,
  );
  assert.match(
    routeSource,
    /from "@\/features\/initiate-contract-deal\/server"/,
  );
  assert.match(serverEntrySource, /initiateContractDealSchema/);
  assert.doesNotMatch(clientEntrySource, /\binitiateContractDealSchema\b/);
});
