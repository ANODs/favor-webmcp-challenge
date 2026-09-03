import type { ContractDto } from "../api/dto";

import { formatCompactDate, formatCurrency } from "@/shared/lib/format";
import { routes } from "@/shared/config/routes";
import { getLocalizedPathname } from "@/shared/lib/seo";

import {
  getContractShareCopy,
  getContractShareIntlLocale,
  type ContractShareLocale,
} from "./share-copy";

const getBaseUrl = () => {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_APP_URL || process.env.BASE_URL || "https://favor.deals";
};

type ContractShareTextOptions = {
  /** A localized display label resolved by the composing layer. */
  categoryLabel?: string | null;
};

export function buildContractShareText(
  contract: ContractDto,
  locale: ContractShareLocale = "ru",
  options: ContractShareTextOptions = {},
) {
  const browserUrl = `${getBaseUrl()}${getLocalizedPathname(
    locale,
    routes.contractBySlug(contract.slug),
  )}`;
  const copy = getContractShareCopy(locale);
  const intlLocale = getContractShareIntlLocale(locale);
  const categoryLabel = options.categoryLabel ?? contract.category;

  const details = [
    contract.title,
    categoryLabel
      ? `${copy.plainCategory}: ${categoryLabel}`
      : null,
    `${copy.plainBudget}: ${
      contract.basePrice === null || contract.basePrice === undefined
        ? copy.plainNotSpecified
        : formatCurrency(contract.basePrice, intlLocale)
    }`,
    `${copy.plainDeadline}: ${
      contract.deadlineDays
        ? `${contract.deadlineDays} ${copy.plainDays}`
        : copy.plainDeadlineNotSpecified
    }`,
    `${copy.plainOpenDeals}: ${contract._count?.deals ?? 0}`,
    `${copy.plainCompletedDeals}: ${contract.completedDealsCount ?? 0}`,
    `${copy.plainReviews}: ${formatContractRating(
      contract.averageRating,
      contract.reviewsCount,
      copy.plainNoReviews,
    )}`,
    `${copy.plainPublished}: ${formatCompactDate(
      contract.createdAt,
      intlLocale,
    )}`,
    "",
    `${copy.plainWebVersion}: ${browserUrl}`,
  ];

  return details.filter(Boolean).join("\n");
}

function formatContractRating(
  rating?: number | null,
  reviewsCount?: number | null,
  noReviews = "",
) {
  if (!rating || !reviewsCount) {
    return noReviews;
  }

  return `${rating.toFixed(1)}/5 (${reviewsCount})`;
}
