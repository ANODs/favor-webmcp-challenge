import { Role } from "@prisma/client";

import { DEFAULT_APP_VERSION } from "@/shared/lib/app-version";

export type StablecoinSymbol = "USDT";

const required = (value: string | undefined, name: string) => {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
};

const configuredTelegramProxyUrl = process.env.TELEGRAM_PROXY_URL?.trim();
const telegramProxyUrl =
  configuredTelegramProxyUrl?.toLowerCase() === "direct"
    ? ""
    : configuredTelegramProxyUrl || "";
const authCookieName = process.env.AUTH_COOKIE_NAME ?? "favor_auth";
export const env = {
  get appVersion() {
    return process.env.APP_VERSION?.trim() || DEFAULT_APP_VERSION.display;
  },
  databaseUrl: process.env.DATABASE_URL ?? "",
  baseUrl: process.env.BASE_URL ?? "https://favor.deals",
  contractAiValidationUrl:
    process.env.CONTRACT_AI_VALIDATION_URL ?? "https://validate.space-z.ai/api/validate-contract",
  glmApiKey: process.env.GLM_API_KEY?.trim() ?? "",
  glmApiBaseUrl:
    process.env.GLM_API_BASE_URL?.trim().replace(/\/+$/, "") ||
    "https://open.bigmodel.cn/api/paas/v4",
  glmTranslationModel:
    process.env.GLM_TRANSLATION_MODEL?.trim() || "glm-4.5-flash",
  get jwtSecret() {
    return (
      process.env.JWT_SECRET ??
      (process.env.NODE_ENV === "production"
        ? required(process.env.JWT_SECRET, "JWT_SECRET")
        : "dev-secret-change-me")
    );
  },
  get abuseIpHashSecret() {
    return process.env.ABUSE_IP_HASH_SECRET ?? this.jwtSecret;
  },
  turnstileSecretKey: process.env.TURNSTILE_SECRET_KEY?.trim() ?? "",
  turnstileSiteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "",
  telegramProxyUrl,
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
  telegramBotUsername: process.env.TELEGRAM_BOT_USERNAME ?? "FavorDealsBot",
  telegramSupportChatId: process.env.TELEGRAM_SUPPORT_CHAT_ID?.trim() ?? "",
  subscriptionPriceStars: Number(process.env.SUBSCRIPTION_PRICE_STARS ?? "199"),
  subscriptionMonthlyPriceUsdt: Number(process.env.SUBSCRIPTION_MONTHLY_PRICE_USDT ?? "2.99"),
  subscriptionYearlyDiscountPercent: Number(process.env.SUBSCRIPTION_YEARLY_DISCOUNT_PERCENT ?? "50"),
  subscriptionFavorDiscountPercent: Number(process.env.SUBSCRIPTION_FAVOR_DISCOUNT_PERCENT ?? "30"),
  telegramStarsPerUsdt: Number(
    process.env.TELEGRAM_STARS_PER_USDT ?? String(199 / 2.99),
  ),
  auctionStartPriceUsdt: Number(process.env.AUCTION_START_PRICE_USDT ?? "0.10"),
  auctionMaxStartFavor: Number(process.env.AUCTION_MAX_START_FAVOR ?? "100"),
  gramUsdtFallbackPrice: Number(process.env.GRAM_USDT_FALLBACK_PRICE ?? "1.40"),
  tonSubscriptionPriceTon: process.env.TON_SUBSCRIPTION_PRICE_TON ?? process.env.SUBSCRIPTION_PRICE_TON ?? "1",
  tonRecipientWallet: process.env.TON_RECIPIENT_WALLET ?? "",
  tonCenterApiKey: process.env.TONCENTER_API_KEY ?? "",
  tonCenterApiBaseUrl: process.env.TONCENTER_API_BASE_URL ?? "https://toncenter.com/api/v2/jsonRPC",
  tonApiBaseUrl: process.env.TONAPI_BASE_URL ?? "https://tonapi.io/v2",
  stablecoinEscrowDeployTon: process.env.STABLECOIN_ESCROW_DEPLOY_TON ?? "0.30",
  stablecoinJettonTransferTon: process.env.STABLECOIN_JETTON_TRANSFER_TON ?? "0.15",
  stablecoinJettonForwardTon: process.env.STABLECOIN_JETTON_FORWARD_TON ?? "0.08",
  stablecoinJettons: {
    USDT: {
      symbol: "USDT" as const,
      decimals: Number(process.env.USDT_JETTON_DECIMALS ?? "6"),
      masterAddress: process.env.USDT_JETTON_MASTER_ADDRESS ?? "",
    },
  },
  authCookieName,
  authRefreshCookieName: `${authCookieName}_refresh`,
  enableDevSessionAuth:
    process.env.NEXT_PUBLIC_ENABLE_DEV_SESSION_AUTH === "true" &&
    process.env.NODE_ENV !== "production",
  moderatorTelegramIds: (process.env.MODERATOR_TELEGRAM_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean),
  devSession: {
    telegramId: BigInt(process.env.DEV_SESSION_TELEGRAM_ID ?? "900000000000001"),
    role:
      process.env.DEV_SESSION_ROLE === Role.moderator
        ? Role.moderator
        : process.env.DEV_SESSION_ROLE === Role.freelancer
          ? Role.freelancer
          : Role.customer,
    name: process.env.DEV_SESSION_NAME ?? "Dev User",
    username: process.env.DEV_SESSION_USERNAME ?? "favor_dev",
  },
  requireTelegramBotToken() {
    return required(this.telegramBotToken, "TELEGRAM_BOT_TOKEN");
  },
  get isTurnstileConfigured() {
    return Boolean(this.turnstileSecretKey && this.turnstileSiteKey);
  },
  requireTelegramSupportChatId() {
    return required(this.telegramSupportChatId, "TELEGRAM_SUPPORT_CHAT_ID");
  },
  requireTonRecipientWallet() {
    return required(this.tonRecipientWallet, "TON_RECIPIENT_WALLET");
  },
  requireStablecoinJetton(symbol: StablecoinSymbol) {
    const token = this.stablecoinJettons[symbol];

    if (!token) {
      throw new Error(`Unsupported stablecoin: ${symbol}`);
    }

    return {
      ...token,
      masterAddress: required(token.masterAddress, `${symbol}_JETTON_MASTER_ADDRESS`),
    };
  },
  favorJettonMasterAddress: process.env.FAVOR_JETTON_MASTER_ADDRESS ?? "EQAHmnWtW8xmGbZHkvXKDRLkOc0s1VvZIinDDUE-SoysgT6n",
  favorOracleMinPriceTon:
    process.env.FAVOR_ORACLE_MIN_PRICE_GRAM ??
    process.env.FAVOR_ORACLE_MIN_PRICE_TON ??
    "0.00000001",
  favorOracleMaxPriceTon:
    process.env.FAVOR_ORACLE_MAX_PRICE_GRAM ??
    process.env.FAVOR_ORACLE_MAX_PRICE_TON ??
    "0.1",
  favorOracleFallbackPriceTon:
    process.env.FAVOR_ORACLE_FALLBACK_PRICE_GRAM ??
    process.env.FAVOR_ORACLE_FALLBACK_PRICE_TON ??
    "0.001",
  requireFavorJettonMasterAddress() {
    return required(this.favorJettonMasterAddress, "FAVOR_JETTON_MASTER_ADDRESS");
  },
};
