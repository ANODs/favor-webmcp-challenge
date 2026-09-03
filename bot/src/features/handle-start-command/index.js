/* eslint-disable @typescript-eslint/no-require-imports */
const {
  buildTelegramBotStartUrl,
  buildContractUrl,
  buildDealUrl,
  buildDealsUrl,
  buildFeedUrl,
  buildSettingsUrl,
} = require("../../shared/lib/links");
const {
  botText,
  getBotCopy,
  normalizeBotLocale,
} = require("../../shared/lib/copy");
const {
  buildCenteredRichMessageUrlButtonRow,
} = require("../../shared/lib/rich-message");

function buildDefaultReply(botUsername, locale, navigationButtons) {
  const normalizedLocale = normalizeBotLocale(locale);
  const defaultCopy = getBotCopy(normalizedLocale, "start.default");
  const buttons = navigationButtons || [
    {
      text: botText(normalizedLocale, "start.buttons.openFeed"),
      url: buildFeedUrl(botUsername),
      style: "success",
    },
    {
      text: botText(normalizedLocale, "start.buttons.myDeals"),
      url: buildDealsUrl(botUsername),
      style: "primary",
    },
    {
      text: botText(normalizedLocale, "start.buttons.settings"),
      url: buildSettingsUrl(botUsername),
    },
  ];

  return {
    richHtml: [
      ...defaultCopy.richHtml,
      buildCenteredRichMessageUrlButtonRow(buttons),
    ].join("\n"),
    text: defaultCopy.text,
    buttons: [],
    fallbackButtons: buttons.map(({ text, url }) => ({ text, url })),
  };
}

function buildReplyByPayload(botUsername, payload, locale = "ru") {
  const normalizedLocale = normalizeBotLocale(locale);

  if (!payload) {
    return buildDefaultReply(botUsername, normalizedLocale);
  }

  if (payload === "notifications") {
    return {
      text: botText(normalizedLocale, "start.notifications"),
      buttons: [
        {
          text: botText(normalizedLocale, "start.buttons.openDeals"),
          url: buildDealsUrl(botUsername),
        },
        {
          text: botText(normalizedLocale, "start.buttons.settings"),
          url: buildSettingsUrl(botUsername),
        },
      ],
    };
  }

  if (payload === "subscription") {
    return {
      text: botText(normalizedLocale, "start.subscription"),
      buttons: [
        {
          text: botText(normalizedLocale, "start.buttons.openSettings"),
          url: buildSettingsUrl(botUsername),
        },
      ],
    };
  }

  if (payload.startsWith("deal_")) {
    const dealId = Number(payload.slice("deal_".length));

    if (Number.isInteger(dealId) && dealId > 0) {
      return {
        text: botText(normalizedLocale, "start.deal", { dealId }),
        buttons: [
          {
            text: botText(normalizedLocale, "start.buttons.openDeal"),
            url: buildDealUrl(botUsername, dealId),
          },
          {
            text: botText(normalizedLocale, "start.buttons.allDeals"),
            url: buildDealsUrl(botUsername),
          },
        ],
      };
    }
  }

  if (payload.startsWith("contract_")) {
    const slug = payload.slice("contract_".length).trim();

    if (slug) {
      return {
        text: botText(normalizedLocale, "start.contract", { slug }),
        buttons: [
          {
            text: botText(normalizedLocale, "start.buttons.openContract"),
            url: buildContractUrl(botUsername, slug),
          },
          {
            text: botText(normalizedLocale, "start.buttons.openFeed"),
            url: buildFeedUrl(botUsername),
          },
        ],
      };
    }
  }

  return buildDefaultReply(botUsername, normalizedLocale, [
    {
      text: botText(normalizedLocale, "start.buttons.enableNotifications"),
      url: buildTelegramBotStartUrl(botUsername, "notifications"),
      style: "success",
    },
    {
      text: botText(normalizedLocale, "start.buttons.openFeed"),
      url: buildFeedUrl(botUsername),
      style: "primary",
    },
    {
      text: botText(normalizedLocale, "start.buttons.openDeals"),
      url: buildDealsUrl(botUsername),
    },
  ]);
}

module.exports = {
  buildReplyByPayload,
};
