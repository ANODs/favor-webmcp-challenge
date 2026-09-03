import { buildCenteredTelegramRichMessageUrlButtonRow } from "@/shared/lib/telegram/rich-message";

import {
  getProfileShareCopy,
  getProfileShareIntlLocale,
  type ProfileShareLocale,
} from "./share-copy";

export type ProfileRichMessageLocale = ProfileShareLocale;

type ProfileRichMessageInput = {
  displayName: string;
  telegramUsername: string | null;
  rating: number | null;
  completedDealsCount: number;
  contractsCount: number;
  reviewsCount: number;
  portfolioCasesCount: number;
  isFavorPremium: boolean;
  isTelegramPremium: boolean;
  telegramLevel: number | null;
  createdAt: Date | string;
  miniAppUrl: string;
  avatarMediaId?: string | null;
};

const escapeHtml = (value: string | number) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

export function buildProfileRichMessageHtml(
  profile: ProfileRichMessageInput,
  locale: ProfileRichMessageLocale,
) {
  const copy = getProfileShareCopy(locale);
  const intlLocale = getProfileShareIntlLocale(locale);
  const rating =
    profile.rating && profile.rating > 0
      ? `${profile.rating.toFixed(1)}/5`
      : copy.richNoRating;
  const username = profile.telegramUsername?.trim().replace(/^@/, "") || null;
  const telegramUrl = username ? `https://t.me/${encodeURIComponent(username)}` : null;
  const rows = [
    [copy.richRating, rating],
    [copy.richCompletedDeals, profile.completedDealsCount],
    [copy.richContracts, profile.contractsCount],
    [copy.richReviews, profile.reviewsCount],
    [copy.richPortfolio, profile.portfolioCasesCount],
  ];
  const tableRows = rows
    .map(
      ([label, value]) =>
        `<tr><td><b>${escapeHtml(label)}</b></td><td>${escapeHtml(value)}</td></tr>`,
    )
    .join("");
  const statuses = [
    profile.isFavorPremium ? `<li><mark>${copy.richFavorPremium}</mark></li>` : null,
    profile.isTelegramPremium ? `<li>${copy.richTelegramPremium}</li>` : null,
    profile.telegramLevel
      ? `<li>${copy.richTelegramLevel}: ${profile.telegramLevel}</li>`
      : null,
  ].filter(Boolean);
  const createdAt = new Intl.DateTimeFormat(intlLocale, {
    dateStyle: "medium",
  }).format(new Date(profile.createdAt));
  const actionButtons = buildCenteredTelegramRichMessageUrlButtonRow([
    {
      text: copy.richOpenWeb,
      url: profile.miniAppUrl,
      style: "primary",
    },
  ]);

  return [
    `<h1>👤 ${escapeHtml(profile.displayName)}</h1>`,
    profile.avatarMediaId
      ? `<figure><img src="tg://photo?id=${escapeHtml(profile.avatarMediaId)}"/><figcaption>${escapeHtml(profile.displayName)}</figcaption></figure>`
      : "",
    `<p>${copy.richProfile}</p>`,
    username && telegramUrl
      ? `<p><a href="${escapeHtml(telegramUrl)}">@${escapeHtml(username)}</a></p>`
      : "",
    `<h2>${copy.richDetails}</h2>`,
    `<table bordered striped compact><tr><th>${copy.richParameter}</th><th>${copy.richValue}</th></tr>${tableRows}</table>`,
    `<h2>${copy.richStatuses}</h2>`,
    statuses.length
      ? `<ul>${statuses.join("")}</ul>`
      : `<p>${copy.richStandardProfile}</p>`,
    actionButtons,
    `<footer>${copy.richMemberSince}: ${escapeHtml(createdAt)} · favor.deals</footer>`,
  ]
    .filter(Boolean)
    .join("\n");
}
