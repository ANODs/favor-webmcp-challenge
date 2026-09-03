import { Prisma } from "@prisma/client";
import { getUserProfileSlug } from "@/shared/lib/profile";
import { buildTelegramAvatarProxyUrl } from "@/shared/lib/telegram/avatar";
import { type ProfileDealSummaryDto, type ProfileReferralDto } from "../api/profile-dto";

const toProfileContractSnapshot = (
  snapshot: Prisma.JsonValue | ProfileDealSummaryDto["contractSnapshot"] | null | undefined,
): ProfileDealSummaryDto["contractSnapshot"] => {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return null;
  }

  const record = snapshot as Record<string, unknown>;

  return {
    title: typeof record.title === "string" ? record.title : null,
    type: typeof record.type === "string" ? record.type : null,
    slug: typeof record.slug === "string" ? record.slug : null,
  };
};

export const toProfileDealSummary = (deal: {
  id: number;
  contractId: number | null;
  price: Prisma.Decimal | number | string;
  deadlineDays: number | null;
  updatedAt: Date | string;
  contract?: {
    slug: string;
    titleRu: string | null;
    titleEn: string | null;
  } | null;
  contractSnapshot?: Prisma.JsonValue | ProfileDealSummaryDto["contractSnapshot"];
}): ProfileDealSummaryDto => ({
  id: deal.id,
  contractId: deal.contractId,
  price: deal.price.toString(),
  deadlineDays: deal.deadlineDays,
  updatedAt: deal.updatedAt instanceof Date ? deal.updatedAt.toISOString() : deal.updatedAt,
  contract: deal.contract ?? null,
  contractSnapshot: toProfileContractSnapshot(deal.contractSnapshot),
});

export const toProfileReferral = (user: {
  id: number;
  name: string | null;
  telegramUsername: string | null;
  telegramFirstName?: string | null;
  telegramLastName?: string | null;
  telegramId: bigint | string;
  isTelegramUsernameHidden: boolean;
  createdAt: Date | string;
}): ProfileReferralDto => ({
  id: user.id,
  name:
    user.name || [user.telegramFirstName, user.telegramLastName].filter(Boolean).join(" ") || null,
  telegramUsername: user.isTelegramUsernameHidden ? null : user.telegramUsername,
  avatarUrl: buildTelegramAvatarProxyUrl(user.telegramId),
  profileSlug: getUserProfileSlug(user),
  createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : user.createdAt,
});
