/* eslint-disable @typescript-eslint/no-require-imports */
const { prisma } = require("./prisma");

function normalizeUserLocale(value) {
  const normalized = String(value || "").trim().toLowerCase();

  if (normalized === "ru" || normalized.startsWith("ru-")) {
    return "ru";
  }

  if (normalized === "en" || normalized.startsWith("en-")) {
    return "en";
  }

  return null;
}

async function resolveUserLocale(telegramUser) {
  const telegramId = telegramUser?.id;

  if (telegramId) {
    try {
      const user = await prisma.user.findUnique({
        where: { telegramId: BigInt(telegramId) },
        select: { languageCode: true },
      });
      const savedLocale = normalizeUserLocale(user?.languageCode);

      if (savedLocale) {
        return savedLocale;
      }
    } catch (error) {
      console.warn("[favor-bot] failed to read the user's saved language", {
        telegramId,
        error,
      });
    }
  }

  return normalizeUserLocale(telegramUser?.language_code) || "ru";
}

module.exports = {
  normalizeUserLocale,
  resolveUserLocale,
};
