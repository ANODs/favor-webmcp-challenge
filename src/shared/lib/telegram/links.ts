import { routes } from "@/shared/config/routes";

const TELEGRAM_SCHEME = "tg://user";
const REFERRAL_START_PARAM_PREFIX = "ref_";
const REFERRAL_TARGET_SEPARATOR = "__";
const CONTRACT_PUBLICATION_DRAFT_START_PREFIX = "draft_";
const CONTRACT_PUBLICATION_DRAFT_TOKEN_PATTERN = /^[A-Za-z0-9_-]{20,64}$/;
const CONTRACT_DEAL_INTENT_START_PREFIX = "contract_deal_";

export const CONTRACT_PUBLICATION_DRAFT_QUERY_PARAM = "draft";
export const CONTRACT_DEAL_INTENT_QUERY_PARAM = "intent";
export const CONTRACT_DEAL_INTENT_QUERY_VALUE = "deal";

type TelegramIdValue = string | bigint | number;

export const normalizeTelegramUsername = (username: string) =>
  username.trim().replace(/^@/, "");

export const buildTelegramProfileUrl = (username: string) =>
  `https://t.me/${normalizeTelegramUsername(username)}`;

export const buildTelegramUserUrl = ({
  telegramUsername,
  telegramId,
}: {
  telegramUsername?: string | null;
  telegramId?: string | bigint | null;
}) => {
  if (telegramUsername) {
    return buildTelegramProfileUrl(telegramUsername);
  }

  if (telegramId) {
    return `${TELEGRAM_SCHEME}?id=${telegramId.toString()}`;
  }

  return null;
};

export const buildTelegramBotStartUrl = (botUsername: string, start: string) =>
  `https://t.me/${normalizeTelegramUsername(botUsername)}?start=${encodeURIComponent(start)}`;

export const buildTelegramChannelBotAdminUrl = (botUsername: string) =>
  `https://t.me/${normalizeTelegramUsername(botUsername)}?startchannel&admin=edit_messages`;

export const buildTelegramMiniAppUrl = (botUsername: string, startApp?: string) => {
  const username = normalizeTelegramUsername(botUsername);

  if (!startApp) {
    return `https://t.me/${username}`;
  }

  return `https://t.me/${username}?startapp=${encodeURIComponent(startApp)}`;
};

export const buildAbsoluteAppUrl = (baseUrl: string, pathname: string) =>
  new URL(pathname, baseUrl).toString();

export const buildDealStartParam = (dealId: number) => `deal_${dealId}`;

export const isContractPublicationDraftToken = (token?: string | null) =>
  CONTRACT_PUBLICATION_DRAFT_TOKEN_PATTERN.test(token?.trim() ?? "");

export const buildContractPublicationDraftStartParam = (token: string) => {
  const normalizedToken = token.trim();

  if (!isContractPublicationDraftToken(normalizedToken)) {
    throw new Error("Invalid contract publication draft token.");
  }

  return `${CONTRACT_PUBLICATION_DRAFT_START_PREFIX}${normalizedToken}`;
};

export const parseContractPublicationDraftStartParam = (
  startParam?: string | null,
) => {
  const normalizedStartParam = startParam?.trim() ?? "";

  if (!normalizedStartParam.startsWith(CONTRACT_PUBLICATION_DRAFT_START_PREFIX)) {
    return null;
  }

  const token = normalizedStartParam.slice(
    CONTRACT_PUBLICATION_DRAFT_START_PREFIX.length,
  );

  return isContractPublicationDraftToken(token) ? token : null;
};

const normalizeReferralTelegramId = (telegramId?: TelegramIdValue | null) => {
  const value = telegramId?.toString().trim();

  return value && /^\d+$/.test(value) ? value : null;
};

const buildAttributedStartParam = (
  targetStartParam: string,
  referrerTelegramId?: TelegramIdValue | null,
) => {
  const normalizedTelegramId = normalizeReferralTelegramId(referrerTelegramId);

  return normalizedTelegramId
    ? `${REFERRAL_START_PARAM_PREFIX}${normalizedTelegramId}${REFERRAL_TARGET_SEPARATOR}${targetStartParam}`
    : targetStartParam;
};

const getStartParamTarget = (startParam: string) => {
  const match = /^ref_\d+__(.+)$/.exec(startParam);

  return match?.[1] ?? startParam;
};

export const buildContractStartParam = (
  slug: string,
  referrerTelegramId?: TelegramIdValue | null,
) => buildAttributedStartParam(`contract_${slug}`, referrerTelegramId);

export const buildContractDealIntentStartParam = (
  slug: string,
  referrerTelegramId?: TelegramIdValue | null,
) =>
  buildAttributedStartParam(
    `${CONTRACT_DEAL_INTENT_START_PREFIX}${slug}`,
    referrerTelegramId,
  );

export const buildProfileStartParam = (
  slug: string,
  referrerTelegramId?: TelegramIdValue | null,
) => buildAttributedStartParam(`profile_${slug}`, referrerTelegramId);

export const buildReportStartParam = (errorDigest?: string | null) => {
  const normalizedDigest = errorDigest?.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40);
  return normalizedDigest ? `report_error_${normalizedDigest}` : "report";
};

export const parseReferralTelegramId = (startParam?: string | null) => {
  const match = /^ref_(\d+)(?:__(?:contract|profile)_.+)?$/.exec(startParam?.trim() ?? "");

  if (!match) {
    return null;
  }

  try {
    return BigInt(match[1]);
  } catch {
    return null;
  }
};

export const TELEGRAM_MINI_APP_START_PARAMS = {
  feed: "feed",
  deals: "deals",
  create: "create",
  profile: "profile",
  settings: "settings",
  subscription: "subscription",
} as const;

export const resolveRouteFromStartParam = (startParam?: string | null) => {
  if (!startParam) {
    return null;
  }

  const targetStartParam = getStartParamTarget(startParam);

  if (targetStartParam === TELEGRAM_MINI_APP_START_PARAMS.feed) {
    return routes.feed;
  }

  if (targetStartParam === TELEGRAM_MINI_APP_START_PARAMS.deals) {
    return routes.deals;
  }

  if (targetStartParam === TELEGRAM_MINI_APP_START_PARAMS.create) {
    return routes.createContract;
  }

  const publicationDraftToken = parseContractPublicationDraftStartParam(targetStartParam);
  if (publicationDraftToken) {
    return `${routes.createContract}?${CONTRACT_PUBLICATION_DRAFT_QUERY_PARAM}=${encodeURIComponent(publicationDraftToken)}`;
  }

  if (targetStartParam === TELEGRAM_MINI_APP_START_PARAMS.profile) {
    return routes.profile;
  }

  if (
    targetStartParam === TELEGRAM_MINI_APP_START_PARAMS.settings ||
    targetStartParam === TELEGRAM_MINI_APP_START_PARAMS.subscription
  ) {
    return routes.settings;
  }

  if (targetStartParam.startsWith("deal_")) {
    const rawId = targetStartParam.slice("deal_".length);
    const parsedId = Number(rawId);

    if (Number.isInteger(parsedId) && parsedId > 0) {
      return routes.dealById(parsedId);
    }
  }

  if (targetStartParam.startsWith(CONTRACT_DEAL_INTENT_START_PREFIX)) {
    const slug = targetStartParam
      .slice(CONTRACT_DEAL_INTENT_START_PREFIX.length)
      .trim();

    if (slug) {
      return `${routes.contractBySlug(slug)}?${CONTRACT_DEAL_INTENT_QUERY_PARAM}=${CONTRACT_DEAL_INTENT_QUERY_VALUE}`;
    }
  }

  if (targetStartParam.startsWith("contract_")) {
    const slug = targetStartParam.slice("contract_".length).trim();

    if (slug) {
      return routes.contractBySlug(slug);
    }
  }

  if (targetStartParam.startsWith("profile_")) {
    const slug = targetStartParam.slice("profile_".length).trim();

    if (slug) {
      return routes.profileBySlug(slug);
    }
  }

  return null;
};

export const buildReferralStartParam = (telegramId: string | bigint | number) => `ref_${telegramId}`;
