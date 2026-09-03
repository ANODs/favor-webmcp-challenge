import assert from "node:assert/strict";
import test from "node:test";

import {
  buildContractShareText,
  type ContractDto,
} from "../../src/entities/contract";
import { buildProfileShareText } from "../../src/entities/user";
import {
  buildReferralShareText,
  formatReferralPreparedDescription,
  getReferralShareCopy,
  getReferralShareIntlLocale,
} from "../../src/features/share-referral";

test("plain contract share text follows the selected English locale", () => {
  const text = buildContractShareText(
    {
      slug: "qa-review",
      title: "QA review",
      category: "Testing",
      basePrice: 250,
      deadlineDays: 5,
      createdAt: "2026-07-27T12:00:00.000Z",
      averageRating: null,
      reviewsCount: 0,
      completedDealsCount: 3,
      _count: { deals: 1 },
    } as ContractDto,
    "en",
    { categoryLabel: "Software testing" },
  );

  assert.match(text, /Category: Software testing/);
  assert.doesNotMatch(text, /Category: Testing/);
  assert.match(text, /Deadline: 5 days/);
  assert.match(text, /Reviews: no reviews/);
  assert.match(
    text,
    /Web version: https:\/\/favor\.deals\/en\/contracts\/qa-review/,
  );
  assert.doesNotMatch(text, /Категория|Веб-версия/);
});

test("plain contract share text prefixes the Russian web path", () => {
  const text = buildContractShareText(
    {
      slug: "design-review",
      title: "Design review",
      category: "Design",
      basePrice: null,
      deadlineDays: null,
      createdAt: "2026-07-27T12:00:00.000Z",
      averageRating: null,
      reviewsCount: 0,
      completedDealsCount: 0,
      _count: { deals: 0 },
    } as ContractDto,
    "ru",
  );

  assert.match(
    text,
    /Веб-версия: https:\/\/favor\.deals\/ru\/contracts\/design-review/,
  );
});

test("plain profile share text follows the selected locale", () => {
  const english = buildProfileShareText(
    {
      displayName: "Alex",
      telegramUsername: "example_creator",
      rating: null,
      completedDealsCount: 4,
      contractsCount: 2,
      profileSlug: "example_creator",
    },
    "en",
  );
  const russian = buildProfileShareText(
    {
      displayName: "Alex",
      rating: null,
      completedDealsCount: 4,
      contractsCount: 2,
      profileSlug: "example_creator",
    },
    "ru",
  );

  assert.match(english, /Rating: no rating/);
  assert.match(english, /Completed deals: 4/);
  assert.match(
    english,
    /Web version: https:\/\/favor\.deals\/en\/profile\/example_creator/,
  );
  assert.match(russian, /Рейтинг: нет оценки/);
  assert.match(russian, /Завершенные сделки: 4/);
  assert.match(
    russian,
    /Веб-версия: https:\/\/favor\.deals\/ru\/profile\/example_creator/,
  );
});

test("plain referral share text includes commercial copy and live platform stats", () => {
  const text = buildReferralShareText(
    {
      rewardSharePercent: 20,
      stats: {
        usersCount: 1250,
        activeContractsCount: 84,
        completedDealsCount: 319,
      },
    },
    "ru",
  );

  assert.match(text, /Favor — работа и сделки в Telegram/);
  assert.match(text, /Участники: 1\s250/);
  assert.match(text, /Активные контракты: 84/);
  assert.match(text, /Завершённые сделки: 319/);
  assert.match(text, /20% от комиссии Favor/);
});

test("prepared referral summary uses the selected resource catalog", () => {
  const englishLocale = getReferralShareIntlLocale("en");
  const russianLocale = getReferralShareIntlLocale("ru");

  assert.equal(getReferralShareCopy("en").title, "Favor — work and deals in Telegram");
  assert.equal(getReferralShareCopy("ru").join, "Присоединиться к Favor");
  assert.equal(
    formatReferralPreparedDescription(
      "en",
      (1250).toLocaleString(englishLocale),
      (84).toLocaleString(englishLocale),
    ),
    "1,250 members · 84 active contracts",
  );
  assert.match(
    formatReferralPreparedDescription(
      "ru",
      (1250).toLocaleString(russianLocale),
      (84).toLocaleString(russianLocale),
    ),
    /1\s250 участников · 84 активных контрактов/,
  );
});
