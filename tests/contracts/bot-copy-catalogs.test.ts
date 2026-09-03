import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const botSourceRoot = path.join(repositoryRoot, "bot", "src");
const englishCatalogPath = path.join(
  botSourceRoot,
  "shared",
  "locales",
  "en.json",
);
const russianCatalogPath = path.join(
  botSourceRoot,
  "shared",
  "locales",
  "ru.json",
);

const englishCatalog = JSON.parse(readFileSync(englishCatalogPath, "utf8"));
const russianCatalog = JSON.parse(readFileSync(russianCatalogPath, "utf8"));
const { botText, normalizeBotLocale } = require(
  "../../bot/src/shared/lib/copy",
) as {
  botText: (
    locale: string,
    copyPath: string,
    values?: Record<string, unknown>,
  ) => string;
  normalizeBotLocale: (locale: string) => "en" | "ru";
};
const {
  buildContractBrowserUrl,
  buildContractOgImageUrl,
} = require("../../bot/src/shared/lib/links") as {
  buildContractBrowserUrl: (
    baseUrl: string,
    slug: string,
    locale: string,
  ) => string;
  buildContractOgImageUrl: (
    baseUrl: string,
    slug: string,
    locale: string,
    updatedAt: Date,
  ) => string;
};

function assertCatalogParity(
  english: unknown,
  russian: unknown,
  copyPath = "root",
) {
  assert.equal(
    Array.isArray(english),
    Array.isArray(russian),
    `${copyPath} must have the same collection type`,
  );

  if (Array.isArray(english) && Array.isArray(russian)) {
    assert.equal(
      english.length,
      russian.length,
      `${copyPath} arrays must have the same length`,
    );
    english.forEach((value, index) => {
      assertCatalogParity(value, russian[index], `${copyPath}[${index}]`);
    });
    return;
  }

  if (
    english !== null &&
    russian !== null &&
    typeof english === "object" &&
    typeof russian === "object"
  ) {
    const englishKeys = Object.keys(english).sort();
    const russianKeys = Object.keys(russian).sort();
    assert.deepEqual(russianKeys, englishKeys, `${copyPath} keys must match`);

    for (const key of englishKeys) {
      assertCatalogParity(
        (english as Record<string, unknown>)[key],
        (russian as Record<string, unknown>)[key],
        `${copyPath}.${key}`,
      );
    }
    return;
  }

  assert.equal(
    typeof russian,
    typeof english,
    `${copyPath} values must have the same type`,
  );
  assert.equal(typeof english, "string", `${copyPath} must be localized text`);
  assert.ok((english as string).trim(), `${copyPath} English text must not be empty`);
  assert.ok((russian as string).trim(), `${copyPath} Russian text must not be empty`);
  const englishPlaceholders = [...(english as string).matchAll(/\{([a-zA-Z0-9_]+)\}/g)]
    .map((match) => match[1])
    .sort();
  const russianPlaceholders = [...(russian as string).matchAll(/\{([a-zA-Z0-9_]+)\}/g)]
    .map((match) => match[1])
    .sort();
  assert.deepEqual(
    russianPlaceholders,
    englishPlaceholders,
    `${copyPath} placeholders must match`,
  );
}

function listJavaScriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return listJavaScriptFiles(entryPath);
    }

    return entry.isFile() && entry.name.endsWith(".js") ? [entryPath] : [];
  });
}

test("bot English and Russian copy catalogs keep exact parity", () => {
  assertCatalogParity(englishCatalog, russianCatalog);
  assert.doesNotMatch(JSON.stringify(englishCatalog), /[А-Яа-яЁё]/u);
});

test("bot runtime JavaScript contains no hardcoded Cyrillic copy", () => {
  const violations = listJavaScriptFiles(botSourceRoot)
    .map((filePath) => ({
      filePath,
      source: readFileSync(filePath, "utf8"),
    }))
    .filter(({ source }) => /[А-Яа-яЁё]/u.test(source))
    .map(({ filePath }) => path.relative(repositoryRoot, filePath));

  assert.deepEqual(violations, []);
});

test("bot copy helper normalizes locale and interpolates dynamic values", () => {
  assert.equal(normalizeBotLocale("en"), "en");
  assert.equal(normalizeBotLocale("de"), "ru");
  assert.equal(
    botText("en", "result.dealNotFound", { dealId: 42 }),
    "Deal #42 was not found.",
  );
  assert.equal(
    botText("ru", "result.dealNotFound", { dealId: 42 }),
    "Сделка #42 не найдена.",
  );
});

test("bot contract public and OG links preserve the selected locale", () => {
  const updatedAt = new Date("2026-08-25T10:00:00.000Z");

  assert.equal(
    buildContractBrowserUrl("https://favor.deals", "design/montage", "en"),
    "https://favor.deals/en/contracts/design%2Fmontage",
  );
  assert.equal(
    buildContractBrowserUrl("https://favor.deals", "design/montage", "ru"),
    "https://favor.deals/ru/contracts/design%2Fmontage",
  );

  const englishOg = new URL(
    buildContractOgImageUrl(
      "https://favor.deals",
      "design/montage",
      "en",
      updatedAt,
    ),
  );
  const russianOg = new URL(
    buildContractOgImageUrl(
      "https://favor.deals",
      "design/montage",
      "ru",
      updatedAt,
    ),
  );

  assert.equal(englishOg.searchParams.get("locale"), "en");
  assert.equal(russianOg.searchParams.get("locale"), "ru");
});
