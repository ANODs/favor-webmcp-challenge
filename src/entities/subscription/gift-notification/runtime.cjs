/* eslint-disable @typescript-eslint/no-require-imports */
"use strict";

const { SUBSCRIPTION_BENEFITS } = require("../model/benefits.runtime.cjs");

const SUBSCRIPTION_GIFT_VIDEO = Object.freeze({
  id: "favor_plus_gift_video",
  mediaId: "favor_plus_gift_video",
  attachmentName: "favor_plus_gift_video_file",
  filename: "favor-plus-gift.mp4",
  contentType: "video/mp4",
  width: 720,
  height: 720,
  duration: 6,
  supportsStreaming: true,
  inputMedia: Object.freeze({
    type: "video",
    media: "attach://favor_plus_gift_video_file",
    width: 720,
    height: 720,
    duration: 6,
    supports_streaming: true,
  }),
});

const GIFT_NOTIFICATION_COPY = Object.freeze({
  en: Object.freeze({
    title: "✨ Favor Plus is now yours",
    gift: "You've received a subscription as a gift",
    sender: "From",
    activeWithExpiration: "Favor Plus is already active until {expiresAt}.",
    active: "Favor Plus is already active.",
    benefitsTitle: "Your Plus benefits",
    benefits: Object.freeze({
      active_contracts: ({ plus }) => `Up to ${plus} active contracts`,
      scout_contracts: ({ plus }) => `Up to ${plus} scout contracts`,
      contact_views: () => "Unlimited contact views",
      feed_priority: () => "Priority in the feed and search",
      og_previews: () => "Social OG previews",
    }),
    footer: "Favor Plus · favor.deals",
    senderFallback: "A Favor user",
    openFavor: "Open Favor ✨",
  }),
  ru: Object.freeze({
    title: "✨ Favor Plus теперь у вас",
    gift: "Вам подарили подписку",
    sender: "Отправитель",
    activeWithExpiration: "Favor Plus уже активирована и действует до {expiresAt}.",
    active: "Favor Plus уже активирована.",
    benefitsTitle: "Теперь вам доступно",
    benefits: Object.freeze({
      active_contracts: ({ plus }) => `До ${plus} активных контрактов`,
      scout_contracts: ({ plus }) => `До ${plus} скаут-контрактов`,
      contact_views: () => "Безлимитный просмотр контактов",
      feed_priority: () => "Приоритет в ленте и поиске",
      og_previews: () => "Генерация OG-превью",
    }),
    footer: "Favor Plus · favor.deals",
    senderFallback: "Пользователь Favor",
    openFavor: "Открыть Favor ✨",
  }),
});

const DATE_LOCALES = Object.freeze({
  en: "en-GB",
  ru: "ru-RU",
});

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function normalizeGiftNotificationLocale(value) {
  const locale = String(value || "").trim().toLowerCase();

  return locale === "en" || locale.startsWith("en-") ? "en" : "ru";
}

function normalizeGiftSenderName(value, fallback) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();

  return normalized ? normalized.slice(0, 80) : fallback;
}

function formatGiftSubscriptionExpiration(locale, value) {
  if (value == null) return null;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat(DATE_LOCALES[locale], {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })
    .format(date)
    .replace(/\.$/u, "");
}

function interpolate(template, values) {
  return Object.entries(values).reduce(
    (message, [key, value]) => message.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

function buildBenefitItems(copy) {
  return SUBSCRIPTION_BENEFITS.map((benefit) => {
    const formatBenefit = copy.benefits[benefit.id];

    if (typeof formatBenefit !== "function") {
      throw new Error(`UNSUPPORTED_SUBSCRIPTION_BENEFIT:${benefit.id}`);
    }

    return {
      ...benefit,
      label: formatBenefit(benefit),
    };
  });
}

function buildSubscriptionGiftNotification({
  locale,
  payerName,
  premiumExpiresAt,
  settingsUrl,
}) {
  const normalizedLocale = normalizeGiftNotificationLocale(locale);
  const copy = GIFT_NOTIFICATION_COPY[normalizedLocale];
  const senderName = normalizeGiftSenderName(payerName, copy.senderFallback);
  const expiresAt = formatGiftSubscriptionExpiration(
    normalizedLocale,
    premiumExpiresAt,
  );
  const benefits = buildBenefitItems(copy);
  const activeMessage = interpolate(
    expiresAt ? copy.activeWithExpiration : copy.active,
    { expiresAt },
  );
  const contentBlocks = [
    `<h1>${escapeHtml(copy.title)}</h1>`,
    `<p>🎁 <b>${escapeHtml(copy.gift)}</b><br>${escapeHtml(copy.sender)}: ${escapeHtml(senderName)}</p>`,
    `<p>${escapeHtml(activeMessage)}</p>`,
    `<h2>${escapeHtml(copy.benefitsTitle)}</h2>`,
    `<ul>${benefits.map((benefit) => `<li>✅ ${escapeHtml(benefit.label)}</li>`).join("")}</ul>`,
    `<footer>${escapeHtml(copy.footer)}</footer>`,
    `<tg-button-row align="center"><tg-button type="url" style="success" url="${escapeHtml(settingsUrl)}">${escapeHtml(copy.openFavor)}</tg-button></tg-button-row>`,
  ];
  const fallbackHtml = contentBlocks.join("\n");
  const html = [
    `<video src="tg://video?id=${SUBSCRIPTION_GIFT_VIDEO.id}"></video>`,
    ...contentBlocks,
  ].join("\n");
  const text = [
    copy.title,
    "",
    `🎁 ${copy.gift}`,
    `${copy.sender}: ${senderName}`,
    "",
    activeMessage,
    "",
    copy.benefitsTitle,
    ...benefits.map((benefit) => `✅ ${benefit.label}`),
  ].join("\n");

  return {
    html,
    fallbackHtml,
    text,
    benefits,
    buttons: [
      {
        text: copy.openFavor,
        url: settingsUrl,
      },
    ],
  };
}

module.exports = {
  SUBSCRIPTION_GIFT_VIDEO,
  buildSubscriptionGiftNotification,
};
