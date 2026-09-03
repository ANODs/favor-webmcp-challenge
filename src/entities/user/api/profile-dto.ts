import type { ReviewDto } from "@/entities/review";
import type { PortfolioCaseDto } from "@/entities/portfolio-case";

import type { UserDto } from "./dto";
import type { UserBadgeDto } from "./user-badge-dto";

export type ProfileUserDto = Pick<
  UserDto,
  | "id"
  | "role"
  | "telegramUsername"
  | "telegramFirstName"
  | "telegramLastName"
  | "avatarUrl"
  | "telegramPremium"
  | "telegramLevel"
  | "isPremium"
  | "name"
  | "rating"
> & {
  profileSlug: string;
  badges: UserBadgeDto[];
};

export type ProfileDealSummaryDto = {
  id: number;
  contractId: number | null;
  price: number | string;
  deadlineDays: number | null;
  updatedAt: string;
  contract?: {
    slug: string;
    titleRu: string | null;
    titleEn: string | null;
  } | null;
  contractSnapshot?: {
    title?: string | null;
    type?: string | null;
    slug?: string | null;
  } | null;
};

export type ProfileReviewItemDto = {
  deal: ProfileDealSummaryDto;
  review: ReviewDto;
};

export type ProfileReferralDto = {
  id: number;
  name: string | null;
  telegramUsername: string | null;
  avatarUrl?: string | null;
  profileSlug: string;
  createdAt: string;
};

export type ProfileContractReferralDto = {
  id: number;
  status: "active" | "paused" | "cancelled";
  source: "scout" | "user_referral";
  rewardPercent: number | string;
  createdAt: string;
  contract: {
    slug: string;
    titleRu: string | null;
    titleEn: string | null;
  };
  rewardsCount: number;
  accruedRewardAmount: string;
  currency: string;
};

export type ProfileContractReferralStatsDto = {
  scoutedContractsCount: number;
  activeContractsCount: number;
  accruedRewardsCount: number;
  accruedRewardAmount: string;
  currency: string;
};

export type ProfileSectionKey =
  | "portfolio"
  | "reviews"
  | "deals"
  | "referrals"
  | "contract-referrals";

export type ProfileSectionItemMap = {
  portfolio: PortfolioCaseDto;
  reviews: ProfileReviewItemDto;
  deals: ProfileDealSummaryDto;
  referrals: ProfileReferralDto;
  "contract-referrals": ProfileContractReferralDto;
};

export type ProfileSectionPageDto<TItem> = {
  items: TItem[];
  nextCursor: string | null;
};

export type UserProfileDto = {
  user: ProfileUserDto;
  contractsCount: number;
  activeContractsCount: number;
  completedDealsCount: number;
  receivedReviewsCount: number;
  referralsCount: number;
  contractReferralsCount: number;
  contractReferralStats: ProfileContractReferralStatsDto;
  portfolioCasesCount: number;
};
