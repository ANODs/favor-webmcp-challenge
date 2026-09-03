import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import contractEnglishCopy from "../../src/entities/contract/lib/share-copy.en.json";
import contractRussianCopy from "../../src/entities/contract/lib/share-copy.ru.json";
import profileEnglishCopy from "../../src/entities/user/lib/share-copy.en.json";
import profileRussianCopy from "../../src/entities/user/lib/share-copy.ru.json";
import referralEnglishCopy from "../../src/features/share-referral/lib/share-copy.en.json";
import referralRussianCopy from "../../src/features/share-referral/lib/share-copy.ru.json";

type StringCatalog = Record<string, string>;

const catalogPairs: Array<{
  name: string;
  en: StringCatalog;
  ru: StringCatalog;
}> = [
  { name: "contract share", en: contractEnglishCopy, ru: contractRussianCopy },
  { name: "profile share", en: profileEnglishCopy, ru: profileRussianCopy },
  { name: "referral share", en: referralEnglishCopy, ru: referralRussianCopy },
];

const runtimeFiles = [
  "src/entities/contract/lib/share.ts",
  "src/entities/contract/lib/telegram-rich-message.ts",
  "src/entities/user/lib/share.ts",
  "src/entities/user/lib/telegram-rich-message.ts",
  "src/features/share-referral/lib/share-message.ts",
  "src/app/api/telegram/prepared-profile-message/route.ts",
  "src/app/api/telegram/prepared-referral-message/route.ts",
];

test("share resource catalogs have matching, non-empty English and Russian keys", () => {
  for (const pair of catalogPairs) {
    assert.deepEqual(
      Object.keys(pair.en).sort(),
      Object.keys(pair.ru).sort(),
      `${pair.name} catalog keys differ`,
    );

    for (const [key, englishValue] of Object.entries(pair.en)) {
      assert.ok(englishValue.trim(), `${pair.name}.${key} is empty in English`);
      assert.ok(pair.ru[key]?.trim(), `${pair.name}.${key} is empty in Russian`);
    }
  }
});

test("share and prepared-message runtime TypeScript contains no Cyrillic copy", () => {
  const offenders = runtimeFiles.filter((filePath) =>
    /[\u0400-\u04ff]/u.test(
      readFileSync(path.resolve(process.cwd(), filePath), "utf8"),
    ),
  );

  assert.deepEqual(offenders, []);
});
