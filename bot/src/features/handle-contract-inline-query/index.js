/* eslint-disable @typescript-eslint/no-require-imports */
const { ContractStatus, DealStatus } = require("@prisma/client");
const {
  buildContractBrowserUrl,
  buildContractDealIntentUrl,
  buildContractOgImageUrl,
  buildCreateContractWebAppUrl,
} = require("../../shared/lib/links");
const {
  isExpiredInlineQueryError,
} = require("../../shared/lib/telegram-api-error");
const { getBotCopy } = require("../../shared/lib/copy");
const {
  buildCenteredRichMessageUrlButtonRow,
} = require("../../shared/lib/rich-message");

const INLINE_PAGE_SIZE = 10;
const INLINE_QUERY_CACHE_SECONDS = 5;
const CONTRACT_SCAN_BATCH_SIZE = 20;
const CONTRACT_SCAN_LIMIT = 60;
const MAX_INLINE_OFFSET = 1000;
const MAX_SEARCH_LENGTH = 100;

const OPEN_DEAL_STATUSES = [
  DealStatus.pending_approval,
  DealStatus.in_progress,
  DealStatus.work_completed_by_freelancer,
  DealStatus.paid_by_customer,
  DealStatus.payment_received_by_freelancer,
  DealStatus.result_sent_by_freelancer,
  DealStatus.result_received_by_customer,
  DealStatus.revision_requested,
  DealStatus.awaiting_review,
  DealStatus.in_dispute,
  DealStatus.cancellation_requested,
];

function getDefaultDependencies() {
  const { getBlockingRestriction } = require("../../shared/lib/account-restrictions");
  const { prisma } = require("../../shared/lib/prisma");
  const { answerInlineQuery } = require("../../shared/lib/telegram-api");

  return {
    answerInlineQuery,
    getBlockingRestriction,
    prisma,
  };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function truncateText(value, maxLength) {
  const characters = Array.from(String(value ?? ""));

  if (characters.length <= maxLength) {
    return characters.join("");
  }

  return `${characters.slice(0, Math.max(0, maxLength - 1)).join("").trimEnd()}…`;
}

function normalizeText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function detectContractTextLanguage(value) {
  const text = String(value ?? "");
  const cyrillicCharacters = text.match(/\p{Script=Cyrillic}/gu)?.length ?? 0;
  const latinCharacters = text.match(/\p{Script=Latin}/gu)?.length ?? 0;

  return cyrillicCharacters > latinCharacters ? "ru" : "en";
}

function buildTitleFromDescription(value) {
  const firstLine = String(value ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^[#*\-\s]+/, ""))
    .find((line) => line.length >= 5);

  return firstLine ? Array.from(firstLine).slice(0, 120).join("") : "";
}

function normalizeLocale(locale) {
  return locale === "en" ? "en" : "ru";
}

function normalizeSearchQuery(query) {
  return truncateText(normalizeText(query), MAX_SEARCH_LENGTH);
}

function parseInlineOffset(value) {
  if (!/^\d+$/.test(String(value ?? ""))) {
    return 0;
  }

  const offset = Number(value);

  return Number.isSafeInteger(offset) && offset >= 0 && offset < MAX_INLINE_OFFSET
    ? offset
    : 0;
}

function buildContractSearchWhere(userId, query) {
  const searchQuery = normalizeSearchQuery(query);
  const filters = [
    {
      OR: [
        { scoutId: null },
        { scoutId: { not: userId } },
      ],
    },
  ];

  if (searchQuery) {
    const normalizedTag = searchQuery.replace(/^#+/, "").toLowerCase();
    const searchFields = [
      { titleRu: { contains: searchQuery, mode: "insensitive" } },
      { titleEn: { contains: searchQuery, mode: "insensitive" } },
      { slug: { contains: searchQuery, mode: "insensitive" } },
      { category: { contains: searchQuery, mode: "insensitive" } },
    ];

    if (normalizedTag) {
      searchFields.push({ tags: { has: normalizedTag } });
    }

    filters.push({ OR: searchFields });
  }

  return {
    authorId: userId,
    status: ContractStatus.active,
    AND: filters,
  };
}

function hasAvailableCapacity(contract) {
  return (
    contract.maxOpenDeals === null ||
    contract.maxOpenDeals === undefined ||
    contract._count.deals < contract.maxOpenDeals
  );
}

async function findAvailableContractsPage(prisma, { userId, query, offset }) {
  let cursor = parseInlineOffset(offset);
  let scanned = 0;
  let hasMore = false;
  const contracts = [];
  const where = buildContractSearchWhere(userId, query);

  while (
    contracts.length < INLINE_PAGE_SIZE &&
    scanned < CONTRACT_SCAN_LIMIT &&
    cursor < MAX_INLINE_OFFSET
  ) {
    const take = Math.min(
      CONTRACT_SCAN_BATCH_SIZE,
      CONTRACT_SCAN_LIMIT - scanned,
      MAX_INLINE_OFFSET - cursor,
    );
    const rows = await prisma.contract.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      skip: cursor,
      take,
      select: {
        id: true,
        slug: true,
        titleRu: true,
        titleEn: true,
        descriptionRu: true,
        descriptionEn: true,
        type: true,
        category: true,
        tags: true,
        mediaRefs: true,
        basePrice: true,
        deadlineDays: true,
        maxOpenDeals: true,
        isEscrow: true,
        escrowCurrency: true,
        updatedAt: true,
        _count: {
          select: {
            deals: {
              where: { status: { in: OPEN_DEAL_STATUSES } },
            },
          },
        },
      },
    });

    if (rows.length === 0) {
      break;
    }

    let processedRows = 0;

    for (const contract of rows) {
      cursor += 1;
      scanned += 1;
      processedRows += 1;

      if (hasAvailableCapacity(contract)) {
        contracts.push(contract);
      }

      if (contracts.length === INLINE_PAGE_SIZE) {
        hasMore = processedRows < rows.length || rows.length === take;
        break;
      }
    }

    if (contracts.length === INLINE_PAGE_SIZE || rows.length < take) {
      break;
    }

    hasMore = cursor < MAX_INLINE_OFFSET;
  }

  if (
    contracts.length < INLINE_PAGE_SIZE &&
    scanned === CONTRACT_SCAN_LIMIT &&
    cursor < MAX_INLINE_OFFSET
  ) {
    hasMore = true;
  }

  return {
    contracts,
    nextOffset: hasMore && cursor < MAX_INLINE_OFFSET ? String(cursor) : "",
  };
}

function getLocalizedContractContent(contract, locale) {
  const isEnglish = locale === "en";
  const localizedTitle = isEnglish ? contract.titleEn : contract.titleRu;
  const otherTitle = isEnglish ? contract.titleRu : contract.titleEn;
  const localizedDescription = isEnglish
    ? contract.descriptionEn
    : contract.descriptionRu;
  const otherDescription = isEnglish
    ? contract.descriptionRu
    : contract.descriptionEn;
  const matchingDescription = [localizedDescription, otherDescription].find(
    (description) =>
      normalizeText(description) &&
      detectContractTextLanguage(description) === locale,
  );

  return {
    title: normalizeText(
      localizedTitle ||
        buildTitleFromDescription(matchingDescription) ||
        otherTitle ||
        getBotCopy(locale, "inlineContract").fallbackTitle,
    ),
    description: normalizeText(
      matchingDescription || localizedDescription || otherDescription || "",
    ),
  };
}

function formatPrice(value, locale, fallback) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return `$${String(value)}`;
  }

  return `$${new Intl.NumberFormat(locale === "en" ? "en-US" : "ru-RU", {
    maximumFractionDigits: 2,
  }).format(amount)}`;
}

function formatEscrowCurrency(currency) {
  return currency === "TON" ? "GRAM" : String(currency || "USDT");
}

function getAvailableCapacity(contract, translations) {
  if (contract.maxOpenDeals === null || contract.maxOpenDeals === undefined) {
    return translations.unlimited;
  }

  return String(Math.max(0, contract.maxOpenDeals - contract._count.deals));
}

function resolvePublicCoverUrl(mediaRefs, baseUrl) {
  if (!Array.isArray(mediaRefs)) {
    return null;
  }

  for (const mediaRef of mediaRefs) {
    if (typeof mediaRef !== "string" || !mediaRef.trim()) {
      continue;
    }

    try {
      const url = new URL(mediaRef, `${baseUrl.replace(/\/$/, "")}/`);

      if (url.protocol === "https:" && !url.username && !url.password) {
        return url.toString();
      }
    } catch {
      // Try the next public image before falling back to the generated preview.
    }
  }

  return null;
}

function buildContractInlineResult(contract, options) {
  const locale = normalizeLocale(options.locale);
  const translations = getBotCopy(locale, "inlineContract");
  const { title, description } = getLocalizedContractContent(contract, locale);
  const browserUrl = buildContractBrowserUrl(options.baseUrl, contract.slug, locale);
  const fallbackImageUrl = buildContractOgImageUrl(
    options.baseUrl,
    contract.slug,
    locale,
    contract.updatedAt,
  );
  const imageUrl = resolvePublicCoverUrl(contract.mediaRefs, options.baseUrl) || fallbackImageUrl;
  const dealUrl = buildContractDealIntentUrl(
    options.botUsername,
    contract.slug,
    options.telegramUserId,
  );
  const contractType = contract.type === "order" ? translations.order : translations.offer;
  const price = formatPrice(contract.basePrice, locale, translations.notSpecified);
  const deadline = contract.deadlineDays
    ? `${contract.deadlineDays} ${translations.day}`
    : translations.notSpecified;
  const payment = contract.isEscrow
    ? `${translations.escrow} · ${formatEscrowCurrency(contract.escrowCurrency)}`
    : translations.direct;
  const capacity = getAvailableCapacity(contract, translations);
  const tags = Array.isArray(contract.tags)
    ? contract.tags.filter(Boolean).slice(0, 5).map((tag) => `#${tag}`).join(" ")
    : "";
  const terms = [
    [translations.type, contractType],
    [translations.budget, price],
    [translations.deadline, deadline],
    [translations.payment, payment],
    [translations.capacity, capacity],
    contract.category
      ? [translations.category, contract.category]
      : null,
    tags ? [translations.tags, tags] : null,
  ].filter(Boolean);
  const tableRows = terms
    .map(
      ([label, value]) =>
        `<tr><td><b>${escapeHtml(label)}</b></td><td>${escapeHtml(value)}</td></tr>`,
    )
    .join("");
  const openContractLabel = getBotCopy(locale, "start.buttons.openContract");
  const actionButtons = buildCenteredRichMessageUrlButtonRow([
    {
      text: translations.createDeal,
      url: dealUrl,
      style: "success",
    },
    {
      text: openContractLabel,
      url: browserUrl,
      style: "primary",
    },
  ]);
  const richMessageHtml = [
    `<h1>${escapeHtml(translations.shareTitle)}</h1>`,
    `<h2>${escapeHtml(truncateText(title, 256))}</h2>`,
    description
      ? `<blockquote>${escapeHtml(truncateText(description, 900))}</blockquote>`
      : null,
    `<h2>${escapeHtml(translations.termsTitle)}</h2>`,
    `<table bordered striped compact>${tableRows}</table>`,
    actionButtons,
    "<footer>Favor Deals · favor.deals</footer>",
  ]
    .filter(Boolean)
    .join("\n");
  const summary = [contractType, price, deadline, payment].join(" · ");
  const updatedAtMs = new Date(contract.updatedAt).getTime();

  return {
    type: "article",
    id: truncateText(
      `contract-${contract.id}-${Number.isFinite(updatedAtMs) ? updatedAtMs : "0"}`,
      64,
    ),
    title: truncateText(title, 256),
    description: truncateText(summary, 256),
    thumbnail_url: imageUrl,
    input_message_content: {
      rich_message: {
        html: richMessageHtml,
      },
    },
  };
}

function buildEmptyResultsButton(baseUrl, locale) {
  const normalizedLocale = normalizeLocale(locale);

  return {
    text: getBotCopy(normalizedLocale, "inlineContract").createContract,
    web_app: {
      url: buildCreateContractWebAppUrl(baseUrl, normalizedLocale),
    },
  };
}

async function answerEmptyInlineQuery(answerInlineQuery, inlineQueryId, baseUrl, locale) {
  await answerInlineQuery(inlineQueryId, [], {
    cacheTime: INLINE_QUERY_CACHE_SECONDS,
    isPersonal: true,
    nextOffset: "",
    button: buildEmptyResultsButton(baseUrl, locale),
  });
}

async function handleContractInlineQuery(inlineQuery, options) {
  if (!inlineQuery?.id || !inlineQuery.from?.id) {
    return { count: 0, status: "ignored" };
  }

  const dependencies = options.dependencies || getDefaultDependencies();
  const locale = normalizeLocale(options.locale);
  const telegramUserId = inlineQuery.from.id;

  try {
    const [user, restriction] = await Promise.all([
      dependencies.prisma.user.findUnique({
        where: { telegramId: BigInt(telegramUserId) },
        select: { id: true },
      }),
      dependencies.getBlockingRestriction(telegramUserId, "communication"),
    ]);

    if (!user || restriction) {
      await answerEmptyInlineQuery(
        dependencies.answerInlineQuery,
        inlineQuery.id,
        options.baseUrl,
        locale,
      );
      return { count: 0, status: restriction ? "restricted" : "not_found" };
    }

    const page = await findAvailableContractsPage(dependencies.prisma, {
      userId: user.id,
      query: inlineQuery.query,
      offset: inlineQuery.offset,
    });
    const results = page.contracts.map((contract) =>
      buildContractInlineResult(contract, {
        baseUrl: options.baseUrl,
        botUsername: options.botUsername,
        locale,
        telegramUserId,
      }),
    );

    await dependencies.answerInlineQuery(inlineQuery.id, results, {
      cacheTime: INLINE_QUERY_CACHE_SECONDS,
      isPersonal: true,
      nextOffset: page.nextOffset,
      button: results.length === 0
        ? buildEmptyResultsButton(options.baseUrl, locale)
        : undefined,
    });

    return { count: results.length, status: "answered" };
  } catch (error) {
    if (isExpiredInlineQueryError(error)) {
      return { count: 0, status: "expired" };
    }

    console.error("[favor-bot] failed to answer contract inline query", error);

    try {
      await answerEmptyInlineQuery(
        dependencies.answerInlineQuery,
        inlineQuery.id,
        options.baseUrl,
        locale,
      );
    } catch (fallbackError) {
      if (isExpiredInlineQueryError(fallbackError)) {
        return { count: 0, status: "expired" };
      }

      throw fallbackError;
    }

    return { count: 0, status: "error" };
  }
}

module.exports = {
  CONTRACT_SCAN_LIMIT,
  INLINE_PAGE_SIZE,
  OPEN_DEAL_STATUSES,
  buildContractInlineResult,
  buildContractSearchWhere,
  buildEmptyResultsButton,
  escapeHtml,
  findAvailableContractsPage,
  handleContractInlineQuery,
  hasAvailableCapacity,
  parseInlineOffset,
  resolvePublicCoverUrl,
};
