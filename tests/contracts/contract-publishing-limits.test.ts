import assert from "node:assert/strict";
import test from "node:test";

import { Role } from "@prisma/client";

import { hasUnlimitedContractPublishing } from "../../src/shared/lib/contract-limits";

test("moderators can publish contracts without account or rate limits", () => {
  assert.equal(hasUnlimitedContractPublishing(Role.moderator), true);
});

test("regular users keep the standard contract publishing limits", () => {
  assert.equal(hasUnlimitedContractPublishing(Role.customer), false);
  assert.equal(hasUnlimitedContractPublishing(Role.freelancer), false);
});
