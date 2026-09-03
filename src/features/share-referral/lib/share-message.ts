import { buildCenteredTelegramRichMessageUrlButtonRow } from "@/shared/lib/telegram/rich-message";

import {
  formatReferralReward,
  getReferralShareCopy,
  getReferralShareIntlLocale,
  type ReferralShareLocale,
} from "./share-copy";

export type { ReferralShareLocale } from "./share-copy";

export type ReferralPlatformStats = {
  usersCount: number;
  activeContractsCount: number;
  completedDealsCount: number;
};

type ReferralShareInput = {
  rewardSharePercent: number;
  stats?: ReferralPlatformStats;
};

type ReferralRichMessageInput = ReferralShareInput & {
  stats: ReferralPlatformStats;
  referralUrl: string;
  imageMediaId?: string | null;
};

const escapeHtml = (value: string | number) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const getIntlLocale = (locale: ReferralShareLocale) =>
  getReferralShareIntlLocale(locale);

const formatNumber = (value: number, locale: ReferralShareLocale) =>
  new Intl.NumberFormat(getIntlLocale(locale)).format(value);

const formatPercent = (value: number, locale: ReferralShareLocale) =>
  new Intl.NumberFormat(getIntlLocale(locale), { maximumFractionDigits: 2 }).format(value);

export function buildReferralShareText(
  input: ReferralShareInput,
  locale: ReferralShareLocale = "ru",
) {
  const copy = getReferralShareCopy(locale);
  const stats = input.stats
    ? [
        `${copy.users}: ${formatNumber(input.stats.usersCount, locale)}`,
        `${copy.activeContracts}: ${formatNumber(input.stats.activeContractsCount, locale)}`,
        `${copy.completedDeals}: ${formatNumber(input.stats.completedDealsCount, locale)}`,
      ].join(" · ")
    : null;

  return [
    copy.title,
    "",
    copy.description,
    stats ? `🚀 ${stats}` : null,
    "",
    `🤝 ${formatReferralReward(
      locale,
      formatPercent(input.rewardSharePercent, locale),
    )}`,
  ]
    .filter((part) => part !== null)
    .join("\n");
}

export function buildReferralRichMessageHtml(
  input: ReferralRichMessageInput,
  locale: ReferralShareLocale,
) {
  const copy = getReferralShareCopy(locale);
  const rows = [
    [copy.users, formatNumber(input.stats.usersCount, locale)],
    [copy.activeContracts, formatNumber(input.stats.activeContractsCount, locale)],
    [copy.completedDeals, formatNumber(input.stats.completedDealsCount, locale)],
  ];
  const tableRows = rows
    .map(
      ([label, value]) =>
        `<tr><td><b>${escapeHtml(label)}</b></td><td>${escapeHtml(value)}</td></tr>`,
    )
    .join("");
  const actionButtons = buildCenteredTelegramRichMessageUrlButtonRow([
    {
      text: copy.join,
      url: input.referralUrl,
      style: "success",
    },
  ]);

  return [
    `<h1>💜 ${escapeHtml(copy.title)}</h1>`,
    input.imageMediaId
      ? `<figure><img src="tg://photo?id=${escapeHtml(input.imageMediaId)}"/><figcaption>Favor Deals</figcaption></figure>`
      : "",
    `<blockquote>${escapeHtml(copy.description)}</blockquote>`,
    `<h2>🚀 ${escapeHtml(copy.community)}</h2>`,
    `<table bordered striped compact><tr><th>${escapeHtml(copy.metric)}</th><th>${escapeHtml(copy.value)}</th></tr>${tableRows}</table>`,
    `<h2>🤝 ${escapeHtml(copy.rewardTitle)}</h2>`,
    `<p>${escapeHtml(
      formatReferralReward(
        locale,
        formatPercent(input.rewardSharePercent, locale),
      ),
    )}</p>`,
    actionButtons,
    `<footer>${escapeHtml(copy.footer)} · favor.deals</footer>`,
  ]
    .filter(Boolean)
    .join("\n");
}
