import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

import { OPEN_DEAL_STATUSES as APP_OPEN_DEAL_STATUSES } from "../../src/entities/deal/model/status";
import { CONTRACT_OG_RENDERER_VERSION as APP_CONTRACT_OG_RENDERER_VERSION } from "../../src/entities/contract/model/og-image";
import { buildContractDealIntentStartParam as buildAppContractDealIntentStartParam } from "../../src/shared/lib/telegram/links";

const require = createRequire(import.meta.url);
const {
  CONTRACT_SCAN_LIMIT,
  INLINE_PAGE_SIZE,
  OPEN_DEAL_STATUSES,
  buildContractInlineResult,
  buildContractSearchWhere,
  findAvailableContractsPage,
  handleContractInlineQuery,
} = require("../../bot/src/features/handle-contract-inline-query");
const {
  CONTRACT_OG_RENDERER_VERSION,
  buildContractDealIntentStartParam,
  buildContractDealIntentUrl,
} = require("../../bot/src/shared/lib/links");
const {
  TelegramApiError,
  isExpiredInlineQueryError,
} = require("../../bot/src/shared/lib/telegram-api-error");

test("bot image includes the shared OG renderer manifest", () => {
  const dockerfile = readFileSync(
    new URL("../../bot/Dockerfile", import.meta.url),
    "utf8",
  );

  assert.match(
    dockerfile,
    /COPY src\/entities\/contract\/og-renderer\.json \.\/src\/entities\/contract\/og-renderer\.json/,
  );
});

const makeContract = (overrides: Record<string, unknown> = {}) => ({
  id: 17,
  slug: "landing-design",
  titleRu: "Дизайн лендинга",
  titleEn: "Landing page design",
  descriptionRu: "Соберу аккуратный лендинг и подготовлю макеты к разработке.",
  descriptionEn: "I will design a polished landing page and hand off the layouts.",
  type: "offer",
  category: "design",
  tags: ["figma", "landing"],
  mediaRefs: [],
  basePrice: "1200.50",
  deadlineDays: 7,
  maxOpenDeals: 3,
  isEscrow: true,
  escrowCurrency: "TON",
  createdAt: new Date("2026-08-20T10:00:00.000Z"),
  updatedAt: new Date("2026-08-25T10:00:00.000Z"),
  _count: { deals: 1 },
  ...overrides,
});

test("deal-intent links preserve the sender acquisition ref", () => {
  const startParam = buildContractDealIntentStartParam(
    "landing-design",
    777000111,
  );

  assert.equal(startParam, "ref_777000111__contract_deal_landing-design");
  assert.equal(
    startParam,
    buildAppContractDealIntentStartParam("landing-design", 777000111),
  );
  assert.equal(
    buildContractDealIntentUrl("@FavorDealsBot", "landing-design", 777000111),
    "https://t.me/FavorDealsBot?startapp=ref_777000111__contract_deal_landing-design",
  );
});

test("only an expired answerInlineQuery error is treated as terminal", () => {
  assert.equal(
    isExpiredInlineQueryError(
      new TelegramApiError(
        "answerInlineQuery",
        400,
        "Bad Request: query is too old and response timeout expired or query ID is invalid",
      ),
    ),
    true,
  );
  assert.equal(
    isExpiredInlineQueryError(
      new TelegramApiError("sendMessage", 400, "query ID is invalid"),
    ),
    false,
  );
  assert.equal(
    isExpiredInlineQueryError(
      new TelegramApiError("answerInlineQuery", 400, "Bad Request: malformed result"),
    ),
    false,
  );
});

test("inline card uses rich HTML with embedded deal and contract actions", () => {
  const result = buildContractInlineResult(
    makeContract({
      titleEn: "Landing <script>alert(1)</script>",
      descriptionEn: "Build & ship <b>safely</b>",
      category: 'design "studio"',
      tags: ["ui<ux"],
    }),
    {
      baseUrl: "https://favor.deals",
      botUsername: "FavorDealsBot",
      locale: "en",
      telegramUserId: 777000111,
    },
  );

  assert.equal(result.type, "article");
  assert.equal(
    result.thumbnail_url,
    `https://favor.deals/api/contracts/landing-design/og-image.png?locale=en&v=1787652000000&renderer=${APP_CONTRACT_OG_RENDERER_VERSION}`,
  );
  assert.equal(
    CONTRACT_OG_RENDERER_VERSION,
    APP_CONTRACT_OG_RENDERER_VERSION,
  );
  const messageHtml = result.input_message_content.rich_message.html;
  assert.match(messageHtml, /<h1>Contract proposal<\/h1>/);
  assert.match(messageHtml, /<table bordered striped compact>/);
  assert.match(
    messageHtml,
    /<tr><td><b>Budget<\/b><\/td><td>\$1,200\.5<\/td><\/tr>/,
  );
  assert.match(messageHtml, /Secure Escrow deal · GRAM/);
  assert.match(messageHtml, /Landing &lt;script&gt;/);
  assert.match(messageHtml, /Build &amp; ship &lt;b&gt;/);
  assert.doesNotMatch(messageHtml, /<script>/);
  assert.doesNotMatch(messageHtml, /<img|tg:\/\/photo/);
  assert.match(
    messageHtml,
    /<tg-button type="url" style="success" url="https:\/\/t\.me\/FavorDealsBot\?startapp=ref_777000111__contract_deal_landing-design">Start a deal<\/tg-button>/,
  );
  assert.match(
    messageHtml,
    /<tg-button type="url" style="primary" url="https:\/\/favor\.deals\/en\/contracts\/landing-design">Open contract<\/tg-button>/,
  );
  assert.match(messageHtml, /<footer>Favor Deals · favor\.deals<\/footer>/);
  assert.equal("message_text" in result.input_message_content, false);
  assert.equal("reply_markup" in result, false);
});

test("inline card recognizes historical English text stored in descriptionRu", () => {
  const result = buildContractInlineResult(
    makeContract({
      titleRu: "Русский заголовок",
      titleEn: null,
      descriptionRu:
        "Video editing and motion design\nDelivery within seven days.",
      descriptionEn: null,
    }),
    {
      baseUrl: "https://favor.deals",
      botUsername: "FavorDealsBot",
      locale: "en",
      telegramUserId: 777000111,
    },
  );

  assert.equal(result.title, "Video editing and motion design");
  assert.match(
    result.input_message_content.rich_message.html,
    /Video editing and motion design Delivery within seven days\./,
  );
  assert.doesNotMatch(
    result.input_message_content.rich_message.html,
    /Русский заголовок/,
  );
});

test("an HTTPS contract cover is preferred over the generated preview", () => {
  const result = buildContractInlineResult(
    makeContract({
      mediaRefs: [
        "tg://photo?id=telegram-only-reference",
        "https://cdn.example.com/contracts/cover.jpg",
      ],
    }),
    {
      baseUrl: "https://favor.deals",
      botUsername: "FavorDealsBot",
      locale: "ru",
      telegramUserId: 777000111,
    },
  );

  assert.equal(result.thumbnail_url, "https://cdn.example.com/contracts/cover.jpg");
  assert.match(
    result.input_message_content.rich_message.html,
    /<tg-button type="url" style="success"[^>]*>Начать сделку<\/tg-button>/,
  );
  assert.match(
    result.input_message_content.rich_message.html,
    /<tg-button type="url" style="primary"[^>]*>Открыть контракт<\/tg-button>/,
  );
});

test("empty query lists eligible contracts and answers as personal with a short cache", async () => {
  const findManyCalls: Array<Record<string, unknown>> = [];
  const answers: Array<{
    id: string;
    results: Array<Record<string, unknown>>;
    options: Record<string, unknown>;
  }> = [];
  const dependencies = {
    prisma: {
      user: {
        findUnique: async () => ({ id: 42 }),
      },
      contract: {
        findMany: async (args: Record<string, unknown>) => {
          findManyCalls.push(args);
          return [
            makeContract(),
            makeContract({ id: 18, maxOpenDeals: 1, _count: { deals: 1 } }),
          ];
        },
      },
    },
    getBlockingRestriction: async (telegramId: number, capability: string) => {
      assert.equal(telegramId, 777000111);
      assert.equal(capability, "communication");
      return null;
    },
    answerInlineQuery: async (
      id: string,
      results: Array<Record<string, unknown>>,
      options: Record<string, unknown>,
    ) => {
      answers.push({ id, results, options });
    },
  };

  const handled = await handleContractInlineQuery(
    {
      id: "inline-1",
      from: { id: 777000111 },
      query: "",
      offset: "",
    },
    {
      baseUrl: "https://favor.deals",
      botUsername: "FavorDealsBot",
      locale: "ru",
      dependencies,
    },
  );

  assert.deepEqual(handled, { count: 1, status: "answered" });
  assert.equal(findManyCalls.length, 1);
  const query = findManyCalls[0];
  assert.deepEqual(query.where, {
    authorId: 42,
    status: "active",
    AND: [{ OR: [{ scoutId: null }, { scoutId: { not: 42 } }] }],
  });
  assert.equal(answers.length, 1);
  assert.equal(answers[0].id, "inline-1");
  assert.equal(answers[0].results.length, 1);
  const inlineResult = answers[0].results[0] as {
    type: string;
    thumbnail_url: string;
  };
  assert.equal(inlineResult.type, "article");
  assert.match(inlineResult.thumbnail_url, /og-image\.png/);
  assert.equal(answers[0].options.isPersonal, true);
  assert.equal(answers[0].options.cacheTime, 5);
  assert.equal(answers[0].options.nextOffset, "");
  assert.equal(answers[0].options.button, undefined);
});

test("search covers both titles, slug, category, and normalized tags", () => {
  const where = buildContractSearchWhere(42, "#FiGmA");
  const searchFilter = where.AND[1];

  assert.deepEqual(searchFilter.OR, [
    { titleRu: { contains: "#FiGmA", mode: "insensitive" } },
    { titleEn: { contains: "#FiGmA", mode: "insensitive" } },
    { slug: { contains: "#FiGmA", mode: "insensitive" } },
    { category: { contains: "#FiGmA", mode: "insensitive" } },
    { tags: { has: "figma" } },
  ]);
});

test("capacity filtering scans a bounded number of rows and returns an opaque next offset", async () => {
  const calls: Array<{ skip: number; take: number }> = [];
  const prisma = {
    contract: {
      findMany: async ({ skip, take }: { skip: number; take: number }) => {
        calls.push({ skip, take });
        return Array.from({ length: take }, (_, index) =>
          makeContract({
            id: skip + index + 1,
            maxOpenDeals: 1,
            _count: { deals: 1 },
          }),
        );
      },
    },
  };

  const page = await findAvailableContractsPage(prisma, {
    userId: 42,
    query: "",
    offset: "",
  });

  assert.equal(page.contracts.length, 0);
  assert.equal(page.nextOffset, String(CONTRACT_SCAN_LIMIT));
  assert.deepEqual(calls, [
    { skip: 0, take: 20 },
    { skip: 20, take: 20 },
    { skip: 40, take: 20 },
  ]);
});

test("a full inline page exposes a next offset so Telegram can keep scrolling", async () => {
  const rows = Array.from({ length: INLINE_PAGE_SIZE + 1 }, (_, index) =>
    makeContract({ id: index + 1, slug: `contract-${index + 1}` }),
  );
  const page = await findAvailableContractsPage(
    {
      contract: {
        findMany: async () => rows,
      },
    },
    { userId: 42, query: "", offset: "" },
  );

  assert.equal(page.contracts.length, INLINE_PAGE_SIZE);
  assert.equal(page.nextOffset, String(INLINE_PAGE_SIZE));
});

test("query enforces active ownership, claimed scouting, and open-deal capacity", async () => {
  let capturedQuery: Record<string, unknown> | undefined;
  const prisma = {
    contract: {
      findMany: async (args: Record<string, unknown>) => {
        capturedQuery = args;
        return [];
      },
    },
  };

  await findAvailableContractsPage(prisma, {
    userId: 42,
    query: "design",
    offset: "0",
  });

  assert.equal((capturedQuery?.where as { status: string }).status, "active");
  assert.equal((capturedQuery?.where as { authorId: number }).authorId, 42);
  const select = capturedQuery?.select as {
    _count: { select: { deals: { where: { status: { in: string[] } } } } };
  };
  assert.deepEqual(select._count.select.deals.where.status.in, OPEN_DEAL_STATUSES);
  assert.deepEqual(OPEN_DEAL_STATUSES, APP_OPEN_DEAL_STATUSES);
  assert.equal(OPEN_DEAL_STATUSES.includes("completed"), false);
  assert.equal(OPEN_DEAL_STATUSES.includes("cancelled"), false);
  assert.equal(OPEN_DEAL_STATUSES.includes("rejected"), false);
});

test("communication restriction suppresses contracts and returns the create-contract empty state", async () => {
  let contractQueries = 0;
  let answer: {
    results: Array<Record<string, unknown>>;
    options: { button?: { web_app?: { url?: string } } };
  } | undefined;
  const dependencies = {
    prisma: {
      user: { findUnique: async () => ({ id: 42 }) },
      contract: {
        findMany: async () => {
          contractQueries += 1;
          return [];
        },
      },
    },
    getBlockingRestriction: async () => ({ id: 9, scope: "communication" }),
    answerInlineQuery: async (
      _id: string,
      results: Array<Record<string, unknown>>,
      options: { button?: { web_app?: { url?: string } } },
    ) => {
      answer = { results, options };
    },
  };

  const handled = await handleContractInlineQuery(
    {
      id: "inline-restricted",
      from: { id: 777000111 },
      query: "",
      offset: "",
    },
    {
      baseUrl: "https://favor.deals",
      botUsername: "FavorDealsBot",
      locale: "en",
      dependencies,
    },
  );

  assert.deepEqual(handled, { count: 0, status: "restricted" });
  assert.equal(contractQueries, 0);
  assert.equal(answer?.results.length, 0);
  assert.equal(
    answer?.options.button?.web_app?.url,
    "https://favor.deals/en/contracts/new",
  );
});

test("an expired inline query is not answered a second time", async () => {
  let answerCalls = 0;
  const dependencies = {
    prisma: {
      user: { findUnique: async () => ({ id: 42 }) },
      contract: { findMany: async () => [makeContract()] },
    },
    getBlockingRestriction: async () => null,
    answerInlineQuery: async () => {
      answerCalls += 1;
      throw new TelegramApiError(
        "answerInlineQuery",
        400,
        "Bad Request: query is too old and response timeout expired or query ID is invalid",
      );
    },
  };

  const handled = await handleContractInlineQuery(
    {
      id: "inline-expired",
      from: { id: 777000111 },
      query: "",
      offset: "",
    },
    {
      baseUrl: "https://favor.deals",
      botUsername: "FavorDealsBot",
      locale: "ru",
      dependencies,
    },
  );

  assert.deepEqual(handled, { count: 0, status: "expired" });
  assert.equal(answerCalls, 1);
});
