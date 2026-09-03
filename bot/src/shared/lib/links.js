/* eslint-disable @typescript-eslint/no-require-imports */
const {
  version: CONTRACT_OG_RENDERER_VERSION,
} = require("../../../../src/entities/contract/og-renderer.json");

function normalizeTelegramUsername(username) {
  return username.trim().replace(/^@/, "");
}

function buildTelegramMiniAppUrl(botUsername, startApp) {
  const username = normalizeTelegramUsername(botUsername);

  if (!startApp) {
    return `https://t.me/${username}`;
  }

  return `https://t.me/${username}?startapp=${encodeURIComponent(startApp)}`;
}

function buildTelegramBotStartUrl(botUsername, start) {
  return `https://t.me/${normalizeTelegramUsername(botUsername)}?start=${encodeURIComponent(start)}`;
}

function normalizeLocale(locale) {
  return locale === "en" ? "en" : "ru";
}

function buildAbsoluteAppUrl(baseUrl, pathname, searchParams = {}) {
  const url = new URL(pathname, `${baseUrl.replace(/\/$/, "")}/`);

  for (const [key, value] of Object.entries(searchParams)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

function withAcquisitionRef(startParam, referrerTelegramId) {
  const referrer = String(referrerTelegramId ?? "").trim();

  return /^\d+$/.test(referrer)
    ? `ref_${referrer}__${startParam}`
    : startParam;
}

function buildContractDealIntentStartParam(slug, referrerTelegramId) {
  return withAcquisitionRef(`contract_deal_${slug}`, referrerTelegramId);
}

function buildDealUrl(botUsername, dealId) {
  return buildTelegramMiniAppUrl(botUsername, `deal_${dealId}`);
}

function buildContractUrl(botUsername, slug) {
  return buildTelegramMiniAppUrl(botUsername, `contract_${slug}`);
}

function buildContractDealIntentUrl(botUsername, slug, referrerTelegramId) {
  return buildTelegramMiniAppUrl(
    botUsername,
    buildContractDealIntentStartParam(slug, referrerTelegramId),
  );
}

function buildContractBrowserUrl(baseUrl, slug, locale) {
  return buildAbsoluteAppUrl(
    baseUrl,
    `${normalizeLocale(locale)}/contracts/${encodeURIComponent(slug)}`,
  );
}

function buildContractOgImageUrl(baseUrl, slug, locale, updatedAt) {
  const updatedAtMs = new Date(updatedAt).getTime();

  return buildAbsoluteAppUrl(
    baseUrl,
    `api/contracts/${encodeURIComponent(slug)}/og-image.png`,
    {
      locale: normalizeLocale(locale),
      v: Number.isFinite(updatedAtMs) ? updatedAtMs : undefined,
      renderer: CONTRACT_OG_RENDERER_VERSION,
    },
  );
}

function buildCreateContractWebAppUrl(baseUrl, locale) {
  return buildAbsoluteAppUrl(
    baseUrl,
    `${normalizeLocale(locale)}/contracts/new`,
  );
}

function buildDealsUrl(botUsername) {
  return buildTelegramMiniAppUrl(botUsername, "deals");
}

function buildFeedUrl(botUsername) {
  return buildTelegramMiniAppUrl(botUsername, "feed");
}

function buildSettingsUrl(botUsername) {
  return buildTelegramMiniAppUrl(botUsername, "settings");
}

module.exports = {
  CONTRACT_OG_RENDERER_VERSION,
  buildAbsoluteAppUrl,
  buildContractBrowserUrl,
  buildContractDealIntentStartParam,
  buildContractDealIntentUrl,
  buildContractOgImageUrl,
  buildTelegramBotStartUrl,
  buildContractUrl,
  buildCreateContractWebAppUrl,
  buildDealUrl,
  buildDealsUrl,
  buildFeedUrl,
  buildSettingsUrl,
};
