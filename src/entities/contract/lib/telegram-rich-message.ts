import { formatCurrency } from "@/shared/lib/format";
import { buildCenteredTelegramRichMessageUrlButtonRow } from "@/shared/lib/telegram/rich-message";
import { getEscrowCurrencyDisplayName } from "@/shared/lib/ton";

import {
  getContractShareCopy,
  getContractShareIntlLocale,
  type ContractShareLocale,
} from "./share-copy";

export type ContractRichMessageLocale = ContractShareLocale;

type ContractRichMessageInput = {
  title: string;
  description: string;
  type: "offer" | "order";
  category: string | null;
  /** A localized display label resolved outside the contract entity. */
  categoryLabel?: string | null;
  tags: string[];
  basePrice: number | string | null;
  deadlineDays: number | null;
  isEscrow: boolean;
  escrowCurrency: string;
  openDealsCount: number;
  completedDealsCount: number;
  uniqueViewsCount: number;
  averageRating: number | null;
  reviewsCount: number;
  createdAt: Date | string;
  browserUrl: string;
  dealUrl: string;
  coverMediaId?: string | null;
};

export const getContractRichMessageCtaLabel = (
  locale: ContractRichMessageLocale,
) => getContractShareCopy(locale).richStartDeal;

const escapeHtml = (value: string | number) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const paragraph = (value: string) => escapeHtml(value).replaceAll("\n", "<br>");

export function buildContractRichMessageHtml(
  contract: ContractRichMessageInput,
  locale: ContractRichMessageLocale,
) {
  const copy = getContractShareCopy(locale);
  const categoryLabel = contract.categoryLabel ?? contract.category;
  const intlLocale = getContractShareIntlLocale(locale);
  const rating =
    contract.averageRating && contract.reviewsCount
      ? `${contract.averageRating.toFixed(1)}/5 (${contract.reviewsCount})`
      : copy.richNoReviews;
  const deadline = contract.deadlineDays
    ? `${contract.deadlineDays} ${copy.richDays}`
    : copy.richNotSpecified;
  const settlement = contract.isEscrow
    ? `${copy.richEscrow} · ${getEscrowCurrencyDisplayName(contract.escrowCurrency)}`
    : copy.richDirect;
  const budget =
    contract.basePrice === null
      ? copy.richNotSpecified
      : formatCurrency(contract.basePrice, intlLocale);
  const createdAt = new Intl.DateTimeFormat(intlLocale, {
    dateStyle: "medium",
  }).format(new Date(contract.createdAt));
  const rows = [
    [copy.richType, contract.type === "offer" ? copy.richOffer : copy.richOrder],
    [copy.richCategory, categoryLabel || copy.richNotSpecified],
    [copy.richBudget, budget],
    [copy.richDeadline, deadline],
    [copy.richSettlement, settlement],
    [copy.richOpenDeals, contract.openDealsCount],
    [copy.richCompletedDeals, contract.completedDealsCount],
    [copy.richViews, contract.uniqueViewsCount],
    [copy.richRating, rating],
  ];
  const tableRows = rows
    .map(
      ([label, value]) =>
        `<tr><td><b>${escapeHtml(label)}</b></td><td>${escapeHtml(value)}</td></tr>`,
    )
    .join("");
  const tags = contract.tags.length
    ? `<h2>${copy.richTags}</h2><ul>${contract.tags
        .map((tag) => `<li>#${escapeHtml(tag.replace(/^#/, ""))}</li>`)
        .join("")}</ul>`
    : "";
  const actionButtons = buildCenteredTelegramRichMessageUrlButtonRow([
    {
      text: copy.richStartDeal,
      url: contract.dealUrl,
      style: "success",
    },
    {
      text: copy.richOpenWeb,
      url: contract.browserUrl,
      style: "primary",
    },
  ]);

  return [
    `<h1>${escapeHtml(contract.title)}</h1>`,
    contract.coverMediaId
      ? `<figure><img src="tg://photo?id=${escapeHtml(contract.coverMediaId)}"/><figcaption>Favor Deals</figcaption></figure>`
      : "",
    `<blockquote>${paragraph(contract.description)}</blockquote>`,
    `<h2>${copy.richDetails}</h2>`,
    `<table bordered striped compact><tr><th>${copy.richParameter}</th><th>${copy.richValue}</th></tr>${tableRows}</table>`,
    tags,
    actionButtons,
    `<footer>${copy.richPublished}: ${escapeHtml(createdAt)} · favor.deals</footer>`,
  ]
    .filter(Boolean)
    .join("\n");
}
