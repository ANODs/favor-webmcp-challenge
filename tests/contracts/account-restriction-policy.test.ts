import assert from "node:assert/strict";
import test from "node:test";

import { AccountRestrictionScope } from "@prisma/client";

import { isAccountRestrictionBlocking } from "../../src/entities/user/server";

test("all_writes blocks new product actions but preserves the support channel", () => {
  assert.equal(
    isAccountRestrictionBlocking(
      AccountRestrictionScope.all_writes,
      "contract:publish",
    ),
    true,
  );
  assert.equal(
    isAccountRestrictionBlocking(AccountRestrictionScope.all_writes, "deal:create"),
    true,
  );
  assert.equal(
    isAccountRestrictionBlocking(AccountRestrictionScope.all_writes, "support:submit"),
    false,
  );
});

test("login_lock blocks every capability", () => {
  const capabilities = [
    "authenticate",
    "account:write",
    "contract:publish",
    "deal:create",
    "communication:write",
    "support:submit",
    "moderation:write",
  ] as const;

  for (const capability of capabilities) {
    assert.equal(
      isAccountRestrictionBlocking(AccountRestrictionScope.login_lock, capability),
      true,
    );
  }
});
