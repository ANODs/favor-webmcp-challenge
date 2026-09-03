/* eslint-disable @typescript-eslint/no-require-imports */
const englishCatalog = require("../locales/en.json");
const russianCatalog = require("../locales/ru.json");

const catalogs = {
  en: englishCatalog,
  ru: russianCatalog,
};

function normalizeBotLocale(locale) {
  return locale === "en" ? "en" : "ru";
}

function getBotCopy(locale, path) {
  const normalizedLocale = normalizeBotLocale(locale);
  const segments = String(path || "").split(".").filter(Boolean);
  let value = catalogs[normalizedLocale];

  for (const segment of segments) {
    value = value?.[segment];
  }

  if (value === undefined) {
    throw new Error(`Missing bot copy: ${normalizedLocale}.${path}`);
  }

  return value;
}

function formatBotCopy(template, values = {}) {
  return String(template).replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : match,
  );
}

function botText(locale, path, values) {
  const value = getBotCopy(locale, path);

  if (typeof value !== "string") {
    throw new TypeError(`Bot copy is not text: ${normalizeBotLocale(locale)}.${path}`);
  }

  return formatBotCopy(value, values);
}

module.exports = {
  botText,
  formatBotCopy,
  getBotCopy,
  normalizeBotLocale,
};
