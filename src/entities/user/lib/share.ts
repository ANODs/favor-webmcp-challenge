import { routes } from "@/shared/config/routes";
import { getLocalizedPathname } from "@/shared/lib/seo";

import {
  getProfileShareCopy,
  type ProfileShareLocale,
} from "./share-copy";

const getBaseUrl = () => {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_APP_URL || process.env.BASE_URL || "https://favor.deals";
};

export function buildProfileShareText(input: {
  displayName: string;
  telegramUsername?: string | null;
  rating?: number | null;
  completedDealsCount: number;
  contractsCount: number;
  profileSlug?: string;
}, locale: ProfileShareLocale = "ru") {
  const browserUrl = input.profileSlug
    ? `${getBaseUrl()}${getLocalizedPathname(
        locale,
        routes.profileBySlug(input.profileSlug),
      )}`
    : null;
  const copy = getProfileShareCopy(locale);

  const details = [
    input.displayName,
    input.telegramUsername ? `Telegram: @${input.telegramUsername}` : null,
    `${copy.plainRating}: ${formatProfileRating(input.rating, copy.plainNoRating)}`,
    `${copy.plainCompletedDeals}: ${input.completedDealsCount}`,
    `${copy.plainContracts}: ${input.contractsCount}`,
    "",
    browserUrl ? `${copy.plainWebVersion}: ${browserUrl}` : null,
  ];

  return details.filter(Boolean).join("\n");
}

function formatProfileRating(rating?: number | null, noRating = "") {
  if (!rating) {
    return noRating;
  }

  return `${rating.toFixed(1)}/5`;
}
