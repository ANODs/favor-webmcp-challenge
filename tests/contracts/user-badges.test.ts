import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  isUserBadgeIconKey,
  isUserBadgeTone,
  paginateUserBadgeCatalog,
  parseUserBadgeCatalogCursor,
  USER_BADGE_CATALOG_PAGE_SIZE,
} from "../../src/entities/user/model/user-badges";

test("user badge catalog uses a bounded stable cursor", () => {
  const records = Array.from(
    { length: USER_BADGE_CATALOG_PAGE_SIZE + 1 },
    (_, index) => ({ id: index + 1, sortOrder: Math.floor(index / 3) }),
  );

  const page = paginateUserBadgeCatalog(records);

  assert.equal(page.items.length, USER_BADGE_CATALOG_PAGE_SIZE);
  assert.equal(page.nextCursor, "v1.7.24");
  assert.deepEqual(parseUserBadgeCatalogCursor(page.nextCursor), {
    sortOrder: 7,
    id: 24,
  });
});

test("user badge catalog cursor validates its canonical tuple", () => {
  assert.equal(parseUserBadgeCatalogCursor(null), undefined);
  assert.deepEqual(parseUserBadgeCatalogCursor("v1.-2.9"), {
    sortOrder: -2,
    id: 9,
  });

  for (const cursor of [
    "v2.1.2",
    "v1.01.2",
    "v1.-0.2",
    "v1.1.0",
    "v1.1.2.extra",
    "v1.not-a-number.2",
  ]) {
    assert.throws(() => parseUserBadgeCatalogCursor(cursor));
  }
});

test("user badge icon and tone catalogs reject arbitrary presentation data", () => {
  const unsafeTone = ["bg-", "[url(", "javascript:", "alert(1))]"].join("");

  assert.equal(isUserBadgeIconKey("sparkles"), true);
  assert.equal(isUserBadgeIconKey("raw-svg"), false);
  assert.equal(isUserBadgeTone("brand-accent"), true);
  assert.equal(isUserBadgeTone(unsafeTone), false);
});

test("alpha badge migration assigns only users present during the migration", () => {
  const migration = readFileSync(
    path.resolve(
      process.cwd(),
      "prisma/migrations/20260831170000_user_badges/migration.sql",
    ),
    "utf8",
  );

  assert.match(migration, /'alpha_user'/u);
  assert.match(
    migration,
    /INSERT INTO "UserBadgeAssignment"[\s\S]+FROM "User"[\s\S]+WHERE "UserBadgeDefinition"\."code" = 'alpha_user'/u,
  );
  assert.doesNotMatch(migration, /CREATE TRIGGER/u);
});
