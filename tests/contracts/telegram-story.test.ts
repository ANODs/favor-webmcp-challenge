import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  getTelegramStoryShareCopy,
  getTelegramStoryShareParams,
} from "../../src/features/share-telegram-story/lib/story-copy";
import storyEnglishCopy from "../../src/features/share-telegram-story/lib/story-copy.en.json";
import storyRussianCopy from "../../src/features/share-telegram-story/lib/story-copy.ru.json";
import { resolveTelegramStoryTheme } from "../../src/features/share-telegram-story/lib/story-theme";
import { parseStoryMediaRange } from "../../src/features/share-telegram-story/server/story-media-store";
import videoEnglishCopy from "../../src/features/share-telegram-story/worker/story-video-copy.en.json";
import videoRussianCopy from "../../src/features/share-telegram-story/worker/story-video-copy.ru.json";
import { isTelegramMobileStoryPlatform } from "../../src/shared/lib/telegram/webapp";

type StoryCatalog = Record<string, string>;

const assertCatalogParity = (
  name: string,
  english: StoryCatalog,
  russian: StoryCatalog,
) => {
  assert.deepEqual(
    Object.keys(english).sort(),
    Object.keys(russian).sort(),
    `${name} catalog keys differ`,
  );

  for (const [key, englishValue] of Object.entries(english)) {
    assert.ok(englishValue.trim(), `${name}.${key} is empty in English`);
    assert.ok(russian[key]?.trim(), `${name}.${key} is empty in Russian`);
  }
};

test("story share and video catalogs keep English/Russian parity", () => {
  assertCatalogParity("story share", storyEnglishCopy, storyRussianCopy);
  assertCatalogParity("story video", videoEnglishCopy, videoRussianCopy);
});

test("story worker uses a browser-resolvable Mediabunny asset", () => {
  const worker = readFileSync(
    join(process.cwd(), "public", "workers", "story-video.worker.mjs"),
    "utf8",
  );
  const readableWorker = worker.replace(/\\u([\da-f]{4})/giu, (_, hex: string) =>
    String.fromCharCode(Number.parseInt(hex, 16)),
  );

  assert.doesNotMatch(worker, /\bfrom\s*["']mediabunny["']/);
  assert.match(worker, /\bfrom\s*["']\/vendor\/mediabunny\.min\.mjs["']/);

  for (const copy of [videoEnglishCopy, videoRussianCopy]) {
    for (const value of Object.values(copy)) {
      assert.ok(
        readableWorker.includes(value),
        `Worker bundle is missing story copy: ${value}`,
      );
    }
  }
});

test("story share output remains unchanged for every target and locale", () => {
  const url = "https://favor.deals/en/contracts/example";
  const targets = [
    {
      type: "contract" as const,
      captionKey: "contractCaption" as const,
      url,
      title: "Contract",
      description: "Description",
      tags: [],
      currency: "USDT",
      openDealsCount: 0,
      completedDealsCount: 0,
      viewsCount: 0,
    },
    {
      type: "profile" as const,
      captionKey: "profileCaption" as const,
      url,
      displayName: "Example",
      rating: 5,
      completedDealsCount: 1,
      contractsCount: 1,
    },
    {
      type: "referral" as const,
      captionKey: "referralCaption" as const,
      url,
    },
  ];

  for (const [locale, catalog] of [
    ["en", storyEnglishCopy],
    ["ru", storyRussianCopy],
  ] as const) {
    for (const { captionKey, ...target } of targets) {
      assert.deepEqual(getTelegramStoryShareCopy(target, locale), {
        text: `${catalog[captionKey]}\n${url}`,
        widgetName: catalog.widget,
      });
    }
  }
});

test("story captions remain within Telegram's 200-character limit and include the target", () => {
  const url = "https://t.me/FavorDealsBot?startapp=contract_example";
  const copy = getTelegramStoryShareCopy(
    {
      type: "contract",
      url,
      title: "A long title",
      description: "A long description",
      tags: [],
      currency: "USDT",
      openDealsCount: 0,
      completedDealsCount: 0,
      viewsCount: 0,
    },
    "ru",
  );

  assert.ok(copy.text.length <= 200);
  assert.ok(copy.text.endsWith(url));
  assert.equal(copy.widgetName, "Открыть в Favor");
});

test("every story keeps a Telegram widget link back to its Favor target", () => {
  const targets = [
    {
      type: "contract" as const,
      url: "https://t.me/FavorDealsBot?startapp=contract_example",
      title: "Contract",
      description: "Description",
      tags: [],
      currency: "USDT",
      openDealsCount: 0,
      completedDealsCount: 0,
      viewsCount: 0,
    },
    {
      type: "profile" as const,
      url: "https://t.me/FavorDealsBot?startapp=profile_example",
      displayName: "Example",
      rating: 5,
      completedDealsCount: 1,
      contractsCount: 1,
    },
    {
      type: "referral" as const,
      url: "https://t.me/FavorDealsBot?startapp=ref_example",
    },
  ];

  targets.forEach((target) => {
    assert.deepEqual(getTelegramStoryShareParams(target, "ru").widget_link, {
      url: target.url,
      name: "Открыть в Favor",
    });
  });
});

test("story media range supports full, bounded, open, and suffix requests", () => {
  assert.equal(parseStoryMediaRange(null, 1000), null);
  assert.deepEqual(parseStoryMediaRange("bytes=100-199", 1000), {
    start: 100,
    end: 199,
  });
  assert.deepEqual(parseStoryMediaRange("bytes=900-", 1000), {
    start: 900,
    end: 999,
  });
  assert.deepEqual(parseStoryMediaRange("bytes=-100", 1000), {
    start: 900,
    end: 999,
  });
  assert.equal(parseStoryMediaRange("bytes=1000-1001", 1000), "invalid");
});

test("story theme follows the resolved account theme and falls back to the system", () => {
  assert.equal(resolveTelegramStoryTheme("light", true), "light");
  assert.equal(resolveTelegramStoryTheme("dark", false), "dark");
  assert.equal(resolveTelegramStoryTheme("system", true), "dark");
  assert.equal(resolveTelegramStoryTheme(undefined, false), "light");
});

test("story sharing is shown only on Telegram mobile platforms", () => {
  for (const platform of ["android", "android_x", "ios", "IOS"]) {
    assert.equal(isTelegramMobileStoryPlatform(platform), true);
  }

  for (const platform of [undefined, "tdesktop", "macos", "weba", "webk", "unigram"]) {
    assert.equal(isTelegramMobileStoryPlatform(platform), false);
  }
});
