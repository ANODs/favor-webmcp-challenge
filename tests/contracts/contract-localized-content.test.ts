import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  applyTelegramPreviewToForm,
  defaultContractFormState,
} from "../../src/entities/contract/model/form";
import { resolveLocalizedContractContent } from "../../src/entities/contract/model/localized-content";
import {
  buildContractOgImagePath,
  buildContractOgRichMediaCacheKey,
  CONTRACT_OG_COVER_STATE,
  CONTRACT_OG_COVER_STATE_HEADER,
  CONTRACT_OG_RENDERER_VERSION,
  getContractOgCacheControl,
  getContractOgCoverImageUrl,
  isContractOgCoverStatePersistable,
} from "../../src/entities/contract/model/og-image";

test("an untranslated English Telegram post populates the English draft", () => {
  const form = applyTelegramPreviewToForm(defaultContractFormState, {
    telegramPostUrl: "https://t.me/example/10",
    telegramChannelUrl: "https://t.me/example",
    description: "Video editing for a product launch. Delivery within seven days.",
    images: [],
  });

  assert.equal(form.descriptionEn.startsWith("Video editing"), true);
  assert.equal(form.descriptionRu, "");
});

test("English OG content recognizes historical English text stored in descriptionRu", () => {
  const content = resolveLocalizedContractContent(
    {
      titleRu: "Russian translation",
      titleEn: null,
      descriptionRu:
        "Video editing and motion design\nDelivery within seven days.",
      descriptionEn: null,
    },
    "en",
    "Contract on Favor",
  );

  assert.equal(content.title, "Video editing and motion design");
  assert.equal(content.description.startsWith("Video editing"), true);
});

test("localized public content never reads a private cached Telegram source", () => {
  const sourceWithPrivateTelegramText = {
    titleRu: "Публичный русский заголовок",
    titleEn: null,
    descriptionRu: "Публичное русское описание",
    descriptionEn: null,
    cachedTelegramText: "Private English source must not be published",
  };

  const content = resolveLocalizedContractContent(
    sourceWithPrivateTelegramText,
    "en",
    "Contract on Favor",
    "Public fallback description",
  );

  assert.equal(content.title, "Публичный русский заголовок");
  assert.equal(content.description, "Публичное русское описание");
  assert.doesNotMatch(`${content.title}\n${content.description}`, /Private English/);
});

test("localized content keeps an explicit title in the requested language", () => {
  const content = resolveLocalizedContractContent(
    {
      titleRu: "Explicit Russian title",
      titleEn: "Explicit English title",
      descriptionRu: "Russian description",
      descriptionEn: "English description",
    },
    "en",
    "Contract on Favor",
  );

  assert.equal(content.title, "Explicit English title");
  assert.equal(content.description, "English description");
});

test("contract OG paths share a renderer-aware immutable cache key", () => {
  assert.equal(CONTRACT_OG_RENDERER_VERSION, "4");

  const path = buildContractOgImagePath({
    slug: "design/review",
    locale: "en",
    updatedAt: new Date("2026-08-27T12:00:00.000Z"),
  });
  const url = new URL(path, "https://favor.deals");

  assert.equal(url.pathname, "/api/contracts/design%2Freview/og-image.png");
  assert.equal(url.searchParams.get("locale"), "en");
  assert.equal(url.searchParams.get("v"), "1787832000000");
  assert.equal(
    url.searchParams.get("renderer"),
    CONTRACT_OG_RENDERER_VERSION,
  );
});

test("contract OG retries only transient cover fallbacks", () => {
  assert.equal(CONTRACT_OG_COVER_STATE_HEADER, "X-Favor-Contract-Og-Cover");
  assert.equal(
    getContractOgCacheControl(CONTRACT_OG_COVER_STATE.embedded),
    "public, max-age=31536000, immutable",
  );
  assert.equal(
    getContractOgCacheControl(CONTRACT_OG_COVER_STATE.none),
    "public, max-age=31536000, immutable",
  );
  assert.equal(
    getContractOgCacheControl(CONTRACT_OG_COVER_STATE.unavailable),
    "public, max-age=0, s-maxage=60, must-revalidate",
  );
  assert.equal(
    isContractOgCoverStatePersistable(CONTRACT_OG_COVER_STATE.embedded),
    true,
  );
  assert.equal(
    isContractOgCoverStatePersistable(CONTRACT_OG_COVER_STATE.none),
    true,
  );
  assert.equal(
    isContractOgCoverStatePersistable(CONTRACT_OG_COVER_STATE.unavailable),
    false,
  );
  assert.equal(isContractOgCoverStatePersistable(null), false);
  assert.equal(isContractOgCoverStatePersistable("unknown"), false);
});

test("contract OG rich media cache is invalidated with the renderer", () => {
  const cacheKey = buildContractOgRichMediaCacheKey({
    contractId: 17,
    locale: "en",
    updatedAt: new Date("2026-08-27T12:00:00.000Z"),
  });

  assert.equal(
    cacheKey,
    `contract:17:1787832000000:en:renderer:${CONTRACT_OG_RENDERER_VERSION}`,
  );
});

test("contract OG uses the primary contract photo", () => {
  const primaryImage = "https://cdn4.telesco.pe/file/primary.jpg";

  assert.equal(
    getContractOgCoverImageUrl([
      primaryImage,
      "https://cdn4.telesco.pe/file/secondary.jpg",
    ]),
    primaryImage,
  );
  assert.equal(getContractOgCoverImageUrl(["javascript:alert(1)"]), null);
  assert.equal(getContractOgCoverImageUrl(["http://cdn4.telesco.pe/file/a"]), null);
  assert.equal(getContractOgCoverImageUrl(["https://example.com/image.jpg"]), null);
  assert.equal(getContractOgCoverImageUrl([]), null);
});

test("prepared contract share keeps the explicitly selected page locale", async () => {
  const [preparedMessageRouteSource, ogImageRouteSource] = await Promise.all([
    readFile(
      new URL(
        "../../src/app/api/telegram/prepared-contract-message/route.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../../src/app/api/contracts/[slug]/og-image.png/route.ts",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  assert.match(preparedMessageRouteSource, /const locale = payload\.locale;/);
  assert.doesNotMatch(
    preparedMessageRouteSource,
    /resolveTelegramMessageLocale/,
  );
  assert.doesNotMatch(preparedMessageRouteSource, /ogImageBase64/);
  assert.doesNotMatch(ogImageRouteSource, /ogImageBase64/);
  assert.match(preparedMessageRouteSource, /CONTRACT_OG_COVER_STATE_HEADER/);
  assert.match(
    preparedMessageRouteSource,
    /isContractOgCoverStatePersistable\(coverState\)/,
  );
  assert.ok(
    preparedMessageRouteSource.indexOf(
      "isContractOgCoverStatePersistable(coverState)",
    ) < preparedMessageRouteSource.indexOf("getOrUploadTelegramRichPhoto({"),
  );
  assert.match(preparedMessageRouteSource, /buildContractOgRichMediaCacheKey/);
  assert.match(ogImageRouteSource, /getContractOgCacheControl\(coverImage\.state\)/);
});
