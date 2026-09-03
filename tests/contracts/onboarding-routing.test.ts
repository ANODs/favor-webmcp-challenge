import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { completeCurrentUserOnboarding } from "../../src/entities/user/server";
import { routes } from "../../src/shared/config/routes";
import {
  buildOnboardingPath,
  CURRENT_ONBOARDING_VERSION,
  hasCompletedCurrentOnboarding,
  resolveOnboardingEntryPath,
  resolveOnboardingReturnTarget,
} from "../../src/shared/lib/onboarding";
import { ONBOARDING_STEP_IDS } from "../../src/views/onboarding-view/model/steps";

test("the current onboarding version gates an incomplete neutral entry once", () => {
  assert.equal(CURRENT_ONBOARDING_VERSION, 1);
  assert.equal(hasCompletedCurrentOnboarding(0), false);
  assert.equal(hasCompletedCurrentOnboarding(1), true);
  assert.equal(hasCompletedCurrentOnboarding(2), true);

  assert.equal(
    resolveOnboardingEntryPath({ onboardingVersion: 0 }),
    "/onboarding?returnTo=%2Ffeed",
  );
  assert.equal(
    resolveOnboardingEntryPath({
      onboardingVersion: CURRENT_ONBOARDING_VERSION,
    }),
    routes.feed,
  );
});

test("an incomplete account is gated on feed but intentful destinations win", () => {
  assert.equal(
    resolveOnboardingEntryPath({
      onboardingVersion: 0,
      destination: routes.feed,
    }),
    buildOnboardingPath(routes.feed),
  );

  const intentfulDestinations = [
    routes.createContract,
    `${routes.createContract}?draft=aB3_-contractDraftToken_1234567890`,
    routes.contractBySlug("portrait-session"),
    `${routes.contractBySlug("portrait-session")}?intent=deal`,
    routes.dealById(42),
    routes.profile,
    routes.profileBySlug("photographer"),
    routes.settings,
  ];

  for (const destination of intentfulDestinations) {
    assert.equal(
      resolveOnboardingEntryPath({ onboardingVersion: 0, destination }),
      destination,
    );
  }
});

test("an unresolved destination still enters onboarding without a feed redirect hop", () => {
  assert.equal(
    resolveOnboardingEntryPath({
      onboardingVersion: 0,
      destination: null,
    }),
    buildOnboardingPath(routes.feed),
  );
});

test("onboarding return targets stay internal and cannot loop", () => {
  assert.equal(resolveOnboardingReturnTarget("https://attacker.example"), routes.feed);
  assert.equal(resolveOnboardingReturnTarget("//attacker.example"), routes.feed);
  assert.equal(resolveOnboardingReturnTarget("/\\attacker.example"), routes.feed);
  assert.equal(resolveOnboardingReturnTarget("/%5C%5Cattacker.example"), routes.feed);
  assert.equal(resolveOnboardingReturnTarget("/en//attacker.example"), routes.feed);
  assert.equal(resolveOnboardingReturnTarget(routes.onboarding), routes.feed);
  assert.equal(
    resolveOnboardingReturnTarget(`/ru${routes.onboarding}?returnTo=/settings`),
    routes.feed,
  );
  assert.equal(
    resolveOnboardingReturnTarget(`/en${routes.settings}?section=profile#privacy`),
    `${routes.settings}?section=profile#privacy`,
  );
  assert.equal(
    resolveOnboardingReturnTarget(`${routes.settings}?section=profile#privacy`),
    `${routes.settings}?section=profile#privacy`,
  );
  assert.equal(
    resolveOnboardingEntryPath({
      onboardingVersion: CURRENT_ONBOARDING_VERSION,
      destination: `/en${routes.settings}`,
    }),
    routes.settings,
  );
  assert.equal(
    resolveOnboardingEntryPath({
      onboardingVersion: 0,
      destination: `/en${routes.feed}`,
    }),
    buildOnboardingPath(routes.feed),
  );
});

test("the dev-session fallback completes without touching the database", async () => {
  const completed = await completeCurrentUserOnboarding({
    id: 0,
    onboardingVersion: 0,
    name: "Local QA",
  });

  assert.deepEqual(completed, {
    id: 0,
    onboardingVersion: CURRENT_ONBOARDING_VERSION,
    name: "Local QA",
  });
});

test("the migration leaves every existing account eligible for version one", () => {
  const migration = readFileSync(
    new URL(
      "../../prisma/migrations/20260831120000_user_onboarding_version/migration.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(
    migration,
    /ADD COLUMN "onboardingVersion" INTEGER NOT NULL DEFAULT 0/,
  );
  assert.doesNotMatch(migration, /UPDATE\s+"User"/i);
  assert.match(migration, /CHECK \("onboardingVersion" >= 0\)/);
});

test("every localized onboarding step has a production WebP asset", () => {
  for (const locale of ["ru", "en"] as const) {
    for (const stepId of ONBOARDING_STEP_IDS) {
      const asset = readFileSync(
        new URL(
          `../../public/images/onboarding/${locale}/${stepId}.webp`,
          import.meta.url,
        ),
      );

      assert.ok(
        asset.byteLength > 10_000,
        `${locale}/${stepId} is unexpectedly small`,
      );
      assert.equal(asset.toString("ascii", 0, 4), "RIFF");
      assert.equal(asset.toString("ascii", 8, 12), "WEBP");
      assert.equal(asset.toString("ascii", 12, 16), "VP8X");
      assert.equal(asset.readUIntLE(24, 3) + 1, 1200);
      assert.equal(asset.readUIntLE(27, 3) + 1, 900);
    }
  }
});
