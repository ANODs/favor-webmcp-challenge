import {
  ContractReferralRewardStatus,
  ContractReferralStatus,
  DealStatus,
  Prisma,
} from "@prisma/client";

import { buildActiveContractAuthorScope } from "@/entities/contract";
import {
  type ProfileContractReferralDto,
  type ProfileReviewItemDto,
  type ProfileSectionKey,
  type ProfileSectionPageDto,
  type UserProfileDto,
  toProfileDealSummary,
  toProfileReferral,
} from "@/entities/user";
import {
  toUserBadgeDto,
  userBadgeDefinitionSelect,
} from "@/entities/user/server";
import { toPortfolioCase, portfolioCaseSelect } from "@/entities/portfolio-case";
import { handleRouteError, ok } from "@/shared/lib/api";
import { prisma } from "@/shared/lib/prisma";
import { getUserProfileSlug, parseUserProfileSlug } from "@/shared/lib/profile";
import { reviewUserSelect, toPublicReview } from "@/shared/lib/review";
import { withComputedPremium } from "@/shared/lib/auth";
import { buildTelegramAvatarProxyUrl } from "@/shared/lib/telegram/avatar";

const profileUserSelect = {
  id: true,
  role: true,
  telegramId: true,
  telegramUsername: true,
  telegramFirstName: true,
  telegramLastName: true,
  telegramPremium: true,
  telegramLevel: true,
  isPremium: true,
  premiumExpiresAt: true,
  name: true,
  rating: true,
  isTelegramUsernameHidden: true,
  badgeAssignments: {
    orderBy: [
      { badge: { sortOrder: "asc" } },
      { badgeId: "asc" },
    ],
    select: {
      badge: {
        select: userBadgeDefinitionSelect,
      },
    },
  },
} satisfies Prisma.UserSelect;

const PROFILE_SECTION_PAGE_SIZE = 6;
const PROFILE_SECTION_KEYS = new Set<ProfileSectionKey>([
  "portfolio",
  "reviews",
  "deals",
  "referrals",
  "contract-referrals",
]);

const profileDealSelect = {
  id: true,
  contractId: true,
  price: true,
  deadlineDays: true,
  updatedAt: true,
  contract: {
    select: {
      slug: true,
      titleRu: true,
      titleEn: true,
    },
  },
  contractSnapshot: true,
} satisfies Prisma.DealSelect;

const profileReviewSelect = {
  id: true,
  dealId: true,
  reviewerId: true,
  reviewedUserId: true,
  rating: true,
  comment: true,
  createdAt: true,
  reviewer: {
    select: reviewUserSelect,
  },
  reviewedUser: {
    select: reviewUserSelect,
  },
  deal: {
    select: profileDealSelect,
  },
} satisfies Prisma.ReviewSelect;

const profileReferralSelect = {
  id: true,
  name: true,
  telegramUsername: true,
  telegramFirstName: true,
  telegramLastName: true,
  telegramId: true,
  isTelegramUsernameHidden: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

const profileContractReferralSelect = {
  id: true,
  status: true,
  source: true,
  rewardPercent: true,
  createdAt: true,
  contract: {
    select: {
      slug: true,
      titleRu: true,
      titleEn: true,
    },
  },
  rewards: {
    where: {
      status: ContractReferralRewardStatus.accrued,
    },
    select: {
      rewardAmount: true,
      currency: true,
    },
  },
} satisfies Prisma.ContractReferralSelect;

const toProfileReviewItem = (
  record: Prisma.ReviewGetPayload<{ select: typeof profileReviewSelect }>,
): ProfileReviewItemDto => {
  const { deal, ...review } = record;

  return {
    deal: toProfileDealSummary(deal),
    review: {
      ...toPublicReview(review),
      createdAt: review.createdAt.toISOString(),
    },
  };
};

const toProfileContractReferral = (
  referral: Prisma.ContractReferralGetPayload<{
    select: typeof profileContractReferralSelect;
  }>,
): ProfileContractReferralDto => {
  const accruedRewardAmount = referral.rewards.reduce(
    (sum, reward) => sum.plus(reward.rewardAmount),
    new Prisma.Decimal(0),
  );

  return {
    id: referral.id,
    status: referral.status,
    source: referral.source,
    rewardPercent: referral.rewardPercent.toString(),
    createdAt: referral.createdAt.toISOString(),
    contract: referral.contract,
    rewardsCount: referral.rewards.length,
    accruedRewardAmount: accruedRewardAmount.toString(),
    currency: referral.rewards[0]?.currency ?? "USDT",
  };
};

const toProfileSectionPage = <TRecord extends { id: number }, TItem>(
  records: TRecord[],
  mapItem: (record: TRecord) => TItem,
): ProfileSectionPageDto<TItem> => {
  const hasNextPage = records.length > PROFILE_SECTION_PAGE_SIZE;
  const pageRecords = records.slice(0, PROFILE_SECTION_PAGE_SIZE);
  const lastRecord = pageRecords.at(-1);

  return {
    items: pageRecords.map(mapItem),
    nextCursor: hasNextPage && lastRecord ? String(lastRecord.id) : null,
  };
};

const parseProfileSection = (request: Request) => {
  const searchParams = new URL(request.url).searchParams;
  const rawSection = searchParams.get("section");

  if (!rawSection) {
    return { section: null, cursor: undefined } as const;
  }

  if (!PROFILE_SECTION_KEYS.has(rawSection as ProfileSectionKey)) {
    throw new Error("UNKNOWN_PROFILE_SECTION");
  }

  const rawCursor = searchParams.get("cursor");
  const cursor = rawCursor ? Number(rawCursor) : undefined;

  if (cursor !== undefined && (!Number.isSafeInteger(cursor) || cursor <= 0)) {
    throw new Error("INVALID_PROFILE_SECTION_CURSOR");
  }

  return { section: rawSection as ProfileSectionKey, cursor };
};

async function getProfileSectionPage(
  userId: number,
  section: ProfileSectionKey,
  cursor?: number,
) {
  const pageArgs: {
    cursor?: { id: number };
    skip?: number;
    take: number;
    orderBy: Array<{ createdAt: "desc" } | { id: "desc" }>;
  } = {
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    take: PROFILE_SECTION_PAGE_SIZE + 1,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  };

  if (section === "portfolio") {
    const records = await prisma.portfolioCase.findMany({
      where: { userId },
      ...pageArgs,
      select: portfolioCaseSelect,
    });

    return toProfileSectionPage(records, toPortfolioCase);
  }

  if (section === "reviews") {
    const records = await prisma.review.findMany({
      where: {
        reviewedUserId: userId,
        reviewerId: { not: userId },
        deal: { status: DealStatus.completed },
      },
      ...pageArgs,
      select: profileReviewSelect,
    });

    return toProfileSectionPage(records, toProfileReviewItem);
  }

  if (section === "deals") {
    const records = await prisma.deal.findMany({
      where: {
        status: DealStatus.completed,
        OR: [{ customerId: userId }, { freelancerId: userId }],
      },
      ...pageArgs,
      select: profileDealSelect,
    });

    return toProfileSectionPage(records, toProfileDealSummary);
  }

  if (section === "referrals") {
    const records = await prisma.user.findMany({
      where: { referredById: userId },
      ...pageArgs,
      select: profileReferralSelect,
    });

    return toProfileSectionPage(records, toProfileReferral);
  }

  const records = await prisma.contractReferral.findMany({
    where: { referrerId: userId },
    ...pageArgs,
    select: profileContractReferralSelect,
  });

  return toProfileSectionPage(records, toProfileContractReferral);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const parsedSlug = parseUserProfileSlug(slug);

    const user = parsedSlug.id
      ? await prisma.user.findUnique({
          where: { id: parsedSlug.id },
          select: profileUserSelect,
        })
      : await prisma.user.findFirst({
          where: {
            telegramUsername: {
              equals: parsedSlug.telegramUsername ?? undefined,
              mode: "insensitive",
            },
          },
          select: profileUserSelect,
        });

    if (!user) {
      throw new Error("NOT_FOUND");
    }

    const { section, cursor } = parseProfileSection(request);

    if (section) {
      return ok(await getProfileSectionPage(user.id, section, cursor));
    }

    const activeContractAuthorScope = buildActiveContractAuthorScope(user.id);
    const [
      contractsCount,
      activeContractsCount,
      completedDealsCount,
      receivedReviewsCount,
      referralsCount,
      portfolioCasesCount,
      contractReferralsCount,
      contractReferralRewardsAggregate,
      activeContractReferralCount,
      scoutedContractsCount,
    ] = await prisma.$transaction([
      prisma.contract.count({
        where: {
          authorId: user.id,
        },
      }),
      prisma.contract.count({
        where: activeContractAuthorScope,
      }),
      prisma.deal.count({
        where: {
          status: DealStatus.completed,
          OR: [{ customerId: user.id }, { freelancerId: user.id }],
        },
      }),
      prisma.review.count({
        where: {
          reviewedUserId: user.id,
          reviewerId: { not: user.id },
          deal: { status: DealStatus.completed },
        },
      }),
      prisma.user.count({
        where: {
          referredById: user.id,
        },
      }),
      prisma.portfolioCase.count({
        where: { userId: user.id },
      }),
      prisma.contractReferral.count({
        where: {
          referrerId: user.id,
        },
      }),
      prisma.contractReferralReward.aggregate({
        where: {
          referrerId: user.id,
          status: ContractReferralRewardStatus.accrued,
        },
        _sum: {
          rewardAmount: true,
        },
        _count: {
          id: true,
        },
      }),
      prisma.contractReferral.count({
        where: {
          referrerId: user.id,
          status: ContractReferralStatus.active,
        },
      }),
      prisma.contract.count({
        where: {
          scoutId: user.id,
        },
      }),
    ]);

    const { telegramId, badgeAssignments, ...profileUser } = user;
    const payload: UserProfileDto = {
      user: {
        ...withComputedPremium(profileUser),
        avatarUrl: buildTelegramAvatarProxyUrl(telegramId),
        telegramUsername: user.isTelegramUsernameHidden ? null : user.telegramUsername,
        profileSlug: getUserProfileSlug(user),
        badges: badgeAssignments.map(({ badge }) => toUserBadgeDto(badge)),
      },
      contractsCount,
      activeContractsCount,
      completedDealsCount,
      receivedReviewsCount,
      referralsCount,
      contractReferralsCount,
      contractReferralStats: {
        scoutedContractsCount,
        activeContractsCount: activeContractReferralCount,
        accruedRewardsCount: contractReferralRewardsAggregate._count.id,
        accruedRewardAmount:
          contractReferralRewardsAggregate._sum.rewardAmount?.toString() ?? "0",
        currency: "USDT",
      },
      portfolioCasesCount,
    };

    return ok(payload);
  } catch (error) {
    return handleRouteError(error);
  }
}
