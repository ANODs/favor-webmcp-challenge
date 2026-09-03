import assert from "node:assert/strict";
import test from "node:test";

import {
  CATEGORY_CATALOG,
  CATEGORY_TAXONOMY_VERSION,
  getCategoryAliases,
  getCategoryLabel,
  isCategoryId,
  normalizeCategoryAlias,
  normalizeCategoryKey,
  resolveCategoryId,
  validateCategoryCatalog,
  type CategoryDefinition,
} from "../../src/entities/category/model/catalog";

test("canonical category catalog has 55 service categories plus manual fallback", () => {
  assert.equal(CATEGORY_TAXONOMY_VERSION, 3);
  assert.equal(CATEGORY_CATALOG.length, 56);
  assert.deepEqual(validateCategoryCatalog(), []);
  assert.equal(new Set(CATEGORY_CATALOG.map(({ id }) => id)).size, 56);
  assert.equal(
    CATEGORY_CATALOG.filter(({ id }) => id === "other.manual").length,
    1,
  );
});

test("every category has distinct bilingual labels and resolves idempotently", () => {
  for (const entry of CATEGORY_CATALOG) {
    assert.ok(entry.labels.ru.trim());
    assert.ok(entry.labels.en.trim());
    assert.notEqual(entry.labels.ru, entry.labels.en);
    assert.equal(isCategoryId(entry.id), true);
    assert.equal(resolveCategoryId(entry.id), entry.id);
    assert.equal(resolveCategoryId(entry.labels.ru), entry.id);
    assert.equal(resolveCategoryId(entry.labels.en), entry.id);
    assert.equal(getCategoryLabel(entry.id, "ru-RU"), entry.labels.ru);
    assert.equal(getCategoryLabel(entry.id, "en-US"), entry.labels.en);
  }
});

test("normalization is Unicode-safe and removes punctuation differences", () => {
  assert.equal(
    normalizeCategoryAlias("  РЕДАКТОР—ВИДЕО,  REELS! "),
    "редактор видео reels",
  );
  assert.equal(normalizeCategoryAlias("ＶＩＤＥＯ　ＥＤＩＴＯＲ"), "video editor");
  assert.equal(normalizeCategoryAlias("монтажёр"), "монтажер");
});

test("video editing role, activity and Russian variants share one category id", () => {
  const aliases = [
    "Video Editing",
    "video editor",
    "редактор видео",
    "видео-редактор",
    "видеомонтажёр",
    "монтажёр",
    "монтажер видео",
    "Reels editor",
    "Reels, Shorts & TikTok Editing",
  ];

  for (const alias of aliases) {
    assert.equal(resolveCategoryId(alias), "media.video_editing", alias);
    assert.equal(normalizeCategoryKey(alias), "media.video_editing", alias);
  }

  assert.ok(getCategoryAliases("media.video_editing").includes("video editor"));
  assert.equal(getCategoryLabel("media.video_editing", "ru"), "Видеомонтаж");
  assert.equal(getCategoryLabel("media.video_editing", "en"), "Video Editing");
});

test("legacy bilingual category names resolve to canonical ids", () => {
  assert.equal(resolveCategoryId("design"), "design.graphic");
  assert.equal(resolveCategoryId("Видеомонтаж и продакшн"), "media.video_editing");
  assert.equal(resolveCategoryId("QA & Software Testing"), "quality.qa");
  assert.equal(resolveCategoryId("Маркетплейсы (Wildberries/Ozon/Amazon)"), "commerce.marketplaces");
  assert.equal(resolveCategoryId("Virtual Assistant & Remote Admin"), "business.assistant");
  assert.equal(resolveCategoryId("Бизнес-планы и питч-деки"), "business.development");
});

test("performance category has bilingual presentation and role aliases", () => {
  assert.equal(resolveCategoryId("актриса"), "media.performance");
  assert.equal(resolveCategoryId("model"), "media.performance");
  assert.equal(resolveCategoryId("on-camera host"), "media.performance");
  assert.equal(
    getCategoryLabel("media.performance", "ru"),
    "Актёры, модели и ведущие",
  );
  assert.equal(
    getCategoryLabel("media.performance", "en"),
    "Acting, Modeling & Presenting",
  );
});

test("TikTok promotion is a dedicated bilingual category", () => {
  assert.equal(resolveCategoryId("TikTok-промо"), "marketing.tiktok_promo");
  assert.equal(resolveCategoryId("TikTok Promotion"), "marketing.tiktok_promo");
  assert.equal(
    getCategoryLabel("marketing.tiktok_promo", "ru"),
    "TikTok-промо",
  );
  assert.equal(
    getCategoryLabel("marketing.tiktok_promo", "en"),
    "TikTok Promotion",
  );
});

test("hospitality category covers service and catering roles without a broad HoReCa alias", () => {
  assert.equal(resolveCategoryId("waiter"), "business.hospitality");
  assert.equal(resolveCategoryId("официант"), "business.hospitality");
  assert.equal(resolveCategoryId("catering"), "business.hospitality");
  assert.equal(resolveCategoryId("фудтрак"), "business.hospitality");
  assert.equal(resolveCategoryId("restaurant staff"), "business.hospitality");
  assert.equal(resolveCategoryId("HoReCa"), null);
  assert.equal(
    getCategoryLabel("business.hospitality", "ru"),
    "Гостеприимство и кейтеринг",
  );
  assert.equal(
    getCategoryLabel("business.hospitality", "en"),
    "Hospitality & Catering",
  );
});

test("unknown values do not silently become a canonical category", () => {
  assert.equal(resolveCategoryId("очень специальная услуга"), null);
  assert.equal(getCategoryLabel("очень специальная услуга", "ru"), null);
  assert.equal(normalizeCategoryKey("  Bespoke—Thing "), "bespoke thing");
  assert.equal(isCategoryId("video editor"), false);
});

test("catalog validation reports normalized aliases owned by different ids", () => {
  const invalidCatalog = [
    {
      id: "first",
      labels: { ru: "Первый", en: "First" },
      aliases: ["Монтажёр"],
    },
    {
      id: "second",
      labels: { ru: "Второй", en: "Second" },
      aliases: ["монтажер"],
    },
  ] satisfies readonly CategoryDefinition[];

  assert.deepEqual(validateCategoryCatalog(invalidCatalog), [
    {
      kind: "alias_collision",
      value: "монтажер",
      categoryIds: ["first", "second"],
    },
  ]);
});
