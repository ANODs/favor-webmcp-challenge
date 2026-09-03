import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  buildContractRichMessageHtml,
  getContractRichMessageCtaLabel,
} from "../../src/entities/contract/telegram-rich-message";
import {
  buildProfileRichMessageHtml,
  formatProfilePreparedDescription,
  getProfileShareCopy,
} from "../../src/entities/user";
import { buildReferralRichMessageHtml } from "../../src/features/share-referral";

const preparedRichMessageRoutes = [
  "src/app/api/telegram/prepared-contract-message/route.ts",
  "src/app/api/telegram/prepared-profile-message/route.ts",
  "src/app/api/telegram/prepared-referral-message/route.ts",
];

test("prepared contract CTA starts a deal in both locales", () => {
  assert.equal(getContractRichMessageCtaLabel("ru"), "Начать сделку");
  assert.equal(getContractRichMessageCtaLabel("en"), "Start a deal");
});

test("prepared rich shares embed their actions instead of attaching reply markup", () => {
  for (const routePath of preparedRichMessageRoutes) {
    const source = readFileSync(path.resolve(process.cwd(), routePath), "utf8");

    assert.match(source, /rich_message:/, routePath);
    assert.doesNotMatch(source, /reply_markup:/, routePath);
  }
});

test("buildContractRichMessageHtml renders Telegram rich headings and a table", () => {
  const html = buildContractRichMessageHtml(
    {
      title: "Дизайн <лендинга>",
      description: "Первый экран\nАдаптивная версия",
      type: "offer",
      category: "ui-ux-design",
      categoryLabel: "Дизайн & UX",
      tags: ["figma", "ui"],
      basePrice: 500,
      deadlineDays: 7,
      isEscrow: true,
      escrowCurrency: "USDT",
      openDealsCount: 2,
      completedDealsCount: 12,
      uniqueViewsCount: 48,
      averageRating: 4.9,
      reviewsCount: 8,
      createdAt: "2026-07-14T12:00:00.000Z",
      browserUrl: "https://favor.deals/ru/contracts/design",
      dealUrl:
        "https://t.me/FavorDealsBot?startapp=contract_deal_design&source=<friend>",
      coverMediaId: "contract_cover",
    },
    "ru",
  );

  assert.match(html, /<h1>Дизайн &lt;лендинга&gt;<\/h1>/);
  assert.match(html, /<table bordered striped compact>/);
  assert.match(html, /<img src="tg:\/\/photo\?id=contract_cover"\/>/);
  assert.match(html, /<blockquote>Первый экран<br>Адаптивная версия<\/blockquote>/);
  assert.match(html, /Безопасная Escrow-сделка · USDT/);
  assert.match(html, /Дизайн &amp; UX/);
  assert.doesNotMatch(html, /ui-ux-design/);
  assert.match(html, /<li>#figma<\/li>/);
  assert.match(html, /<tg-button-row align="center">/);
  assert.match(
    html,
    /<tg-button type="url" style="success" url="https:\/\/t\.me\/FavorDealsBot\?startapp=contract_deal_design&amp;source=&lt;friend&gt;">Начать сделку<\/tg-button>/,
  );
  assert.match(
    html,
    /<tg-button type="url" style="primary" url="https:\/\/favor\.deals\/ru\/contracts\/design">Открыть веб-версию<\/tg-button>/,
  );
  assert.doesNotMatch(html, /Дизайн <лендинга>/);
});

test("buildContractRichMessageHtml localizes English empty values", () => {
  const html = buildContractRichMessageHtml(
    {
      title: "QA review",
      description: "Regression testing",
      type: "order",
      category: null,
      tags: [],
      basePrice: null,
      deadlineDays: null,
      isEscrow: false,
      escrowCurrency: "TON",
      openDealsCount: 0,
      completedDealsCount: 0,
      uniqueViewsCount: 1,
      averageRating: null,
      reviewsCount: 0,
      createdAt: "2026-07-14T12:00:00.000Z",
      browserUrl: "https://favor.deals/en/contracts/qa",
      dealUrl: "https://t.me/FavorDealsBot?startapp=contract_deal_qa",
    },
    "en",
  );

  assert.match(html, /<h2>Details<\/h2>/);
  assert.match(html, /Direct settlement/);
  assert.match(html, /Not specified/);
  assert.match(
    html,
    /<tg-button type="url" style="success" url="https:\/\/t\.me\/FavorDealsBot\?startapp=contract_deal_qa">Start a deal<\/tg-button>/,
  );
  assert.match(
    html,
    /<tg-button type="url" style="primary" url="https:\/\/favor\.deals\/en\/contracts\/qa">Open web version<\/tg-button>/,
  );
  assert.doesNotMatch(html, /Не указано/);
});

test("buildProfileRichMessageHtml renders rich profile formatting with an avatar", () => {
  const html = buildProfileRichMessageHtml(
    {
      displayName: "Alex <Creator>",
      telegramUsername: "example_creator",
      rating: 4.8,
      completedDealsCount: 12,
      contractsCount: 4,
      reviewsCount: 9,
      portfolioCasesCount: 3,
      isFavorPremium: true,
      isTelegramPremium: true,
      telegramLevel: 6,
      createdAt: "2026-07-14T12:00:00.000Z",
      miniAppUrl:
        "https://t.me/FavorDealsBot?startapp=ref_42424241__profile_example_creator",
      avatarMediaId: "profile_avatar",
    },
    "ru",
  );

  assert.match(html, /<h1>👤 Alex &lt;Creator&gt;<\/h1>/);
  assert.match(html, /<img src="tg:\/\/photo\?id=profile_avatar"\/>/);
  assert.match(html, /<table bordered striped compact>/);
  assert.match(html, /Завершённые сделки/);
  assert.match(html, /<mark>Favor Plus<\/mark>/);
  assert.match(html, /Уровень Telegram: 6/);
  assert.match(html, /<tg-button-row align="center">/);
  assert.match(
    html,
    /<tg-button type="url" style="primary" url="https:\/\/t\.me\/FavorDealsBot\?startapp=ref_42424241__profile_example_creator">Открыть профиль в Favor<\/tg-button>/,
  );
  assert.doesNotMatch(html, /Alex <Creator>/);
});

test("buildProfileRichMessageHtml omits private Telegram data and localizes empty values", () => {
  const html = buildProfileRichMessageHtml(
    {
      displayName: "Private member",
      telegramUsername: null,
      rating: null,
      completedDealsCount: 0,
      contractsCount: 0,
      reviewsCount: 0,
      portfolioCasesCount: 0,
      isFavorPremium: false,
      isTelegramPremium: false,
      telegramLevel: null,
      createdAt: "2026-07-14T12:00:00.000Z",
      miniAppUrl: "https://t.me/FavorDealsBot?startapp=profile_id-42",
    },
    "en",
  );

  assert.match(html, /No rating/);
  assert.match(html, /Standard profile/);
  assert.match(
    html,
    /<tg-button type="url" style="primary" url="https:\/\/t\.me\/FavorDealsBot\?startapp=profile_id-42">Open profile in Favor<\/tg-button>/,
  );
  assert.doesNotMatch(html, /<a href="https:\/\/t\.me\//);
  assert.doesNotMatch(html, /tg:\/\/photo/);
});

test("prepared profile summary uses the selected resource catalog", () => {
  assert.equal(getProfileShareCopy("en").preparedFallbackName, "Favor member");
  assert.equal(getProfileShareCopy("ru").preparedFallbackName, "Участник Favor");
  assert.equal(
    formatProfilePreparedDescription("en", 12, 4),
    "12 completed deals · 4 contracts",
  );
  assert.equal(
    formatProfilePreparedDescription("ru", 12, 4),
    "12 завершённых сделок · 4 контрактов",
  );
});

test("buildReferralRichMessageHtml renders the brand image, stats, and referral CTA", () => {
  const html = buildReferralRichMessageHtml(
    {
      stats: {
        usersCount: 1250,
        activeContractsCount: 84,
        completedDealsCount: 319,
      },
      rewardSharePercent: 20,
      referralUrl: "https://t.me/FavorDealsBot?startapp=ref_42424241&source=<friend>",
      imageMediaId: "favor_referral",
    },
    "ru",
  );

  assert.match(html, /<h1>💜 Favor — работа и сделки в Telegram<\/h1>/);
  assert.match(html, /<img src="tg:\/\/photo\?id=favor_referral"\/>/);
  assert.match(html, /<table bordered striped compact>/);
  assert.match(html, /1\s250/);
  assert.match(html, /20% от комиссии Favor/);
  assert.match(html, /source=&lt;friend&gt;/);
  assert.match(html, /<tg-button-row align="center">/);
  assert.match(
    html,
    /<tg-button type="url" style="success" url="https:\/\/t\.me\/FavorDealsBot\?startapp=ref_42424241&amp;source=&lt;friend&gt;">Присоединиться к Favor<\/tg-button>/,
  );
  assert.doesNotMatch(html, /source=<friend>/);
});
