function required(value, name) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

const configuredTelegramProxyUrl = process.env.TELEGRAM_PROXY_URL?.trim();
const telegramProxyUrl =
  configuredTelegramProxyUrl?.toLowerCase() === "direct"
    ? ""
    : configuredTelegramProxyUrl || "";

const env = {
  telegramBotToken: required(process.env.TELEGRAM_BOT_TOKEN, "TELEGRAM_BOT_TOKEN"),
  telegramProxyUrl,
  telegramBotUsername: (process.env.TELEGRAM_BOT_USERNAME || "FavorDealsBot").replace(/^@/, ""),
  supportChatId:
    process.env.TELEGRAM_SUPPORT_CHAT_ID ||
    (process.env.MODERATOR_TELEGRAM_IDS || "").split(",")[0]?.trim() ||
    "",
  baseUrl: process.env.BASE_URL || "https://favor.deals",
  subscriptionPriceStars: Number(process.env.SUBSCRIPTION_PRICE_STARS || "199"),
  pollingTimeoutSeconds: Number(process.env.TELEGRAM_BOT_POLLING_TIMEOUT_SECONDS || "25"),
  pollingRetryDelayMs: Number(process.env.TELEGRAM_BOT_RETRY_DELAY_MS || "3000"),
};

module.exports = {
  env,
};
