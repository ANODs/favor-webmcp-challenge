import { ContractStatus, DealStatus, Prisma } from "@prisma/client";
import { prisma } from "@/shared/lib/prisma";
import { isDatabaseUnavailableError } from "@/shared/lib/prisma-errors";
import { normalizeMediaRefs } from "@/shared/lib/format";
import { toPublicReviewUser } from "@/shared/lib/review";

import type { ContractDto } from "@/entities/contract";
import { serializeContractTelegramSourceForViewer } from "@/entities/contract/server";
import { buildTelegramAvatarProxyUrl } from "@/shared/lib/telegram/avatar";

const popularContractSelect = {
  id: true,
  authorId: true,
  titleRu: true,
  titleEn: true,
  slug: true,
  descriptionRu: true,
  descriptionEn: true,
  type: true,
  category: true,
  tags: true,
  basePrice: true,
  deadlineDays: true,
  maxOpenDeals: true,
  status: true,
  moderationComment: true,
  telegramPostUrl: true,
  telegramChannelUrl: true,
  mediaRefs: true,
  isEscrow: true,
  escrowCurrency: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ContractSelect;

type PopularContractRecord = Prisma.ContractGetPayload<{
  select: typeof popularContractSelect;
}>;

type PopularContractMetrics = {
  uniqueViewsCount: number;
  completedDealsCount: number;
  averageRating: number | null;
  reviewsCount: number;
};

export const toPublicPopularContract = (
  contract: PopularContractRecord,
  metrics: PopularContractMetrics,
): ContractDto => {
  const publicContract = serializeContractTelegramSourceForViewer(
    contract,
    null,
  );

  return {
    id: contract.id,
    authorId: contract.authorId,
    title: contract.titleRu || contract.titleEn || "",
    titleRu: contract.titleRu,
    titleEn: contract.titleEn,
    slug: contract.slug,
    description: contract.descriptionRu || contract.descriptionEn || "",
    descriptionRu: contract.descriptionRu,
    descriptionEn: contract.descriptionEn,
    type: contract.type as "offer" | "order",
    category: contract.category,
    tags: contract.tags,
    basePrice: contract.basePrice?.toString() ?? null,
    deadlineDays: contract.deadlineDays,
    maxOpenDeals: contract.maxOpenDeals,
    status: contract.status as ContractDto["status"],
    moderationComment: contract.moderationComment,
    telegramPostUrl: publicContract.telegramPostUrl,
    telegramChannelUrl: publicContract.telegramChannelUrl,
    mediaRefs: normalizeMediaRefs(contract.mediaRefs),
    uniqueViewsCount: metrics.uniqueViewsCount,
    completedDealsCount: metrics.completedDealsCount,
    averageRating: metrics.averageRating,
    reviewsCount: metrics.reviewsCount,
    createdAt: contract.createdAt.toISOString(),
    updatedAt: contract.updatedAt.toISOString(),
    isEscrow: contract.isEscrow,
    escrowCurrency: contract.escrowCurrency,
    _count: {
      deals: metrics.completedDealsCount,
    },
  };
};

export async function getPlatformStats() {
  if (!process.env.DATABASE_URL) {
    return {
      totalContracts: 0,
      totalViews: 0,
      totalDeals: 0,
      chartData: [],
      latestReview: null,
    };
  }

  try {
    const [totalContracts, totalViews, totalDeals, latestReview] = await Promise.all([
      prisma.contract.count({ where: { status: ContractStatus.active } }),
      prisma.contractView.count(),
      prisma.deal.count({ where: { status: DealStatus.completed } }),
      prisma.review.findFirst({
        where: { rating: { gte: 4 }, comment: { not: null } },
        orderBy: { createdAt: "desc" },
        include: {
          reviewer: {
            select: {
              id: true,
              name: true,
              telegramId: true,
              telegramUsername: true,
              telegramFirstName: true,
              telegramLastName: true,
              isTelegramUsernameHidden: true,
            },
          },
        },
      }),
    ]);

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Check deals today
    const dealsToday = await prisma.deal.findMany({
      where: {
        status: DealStatus.completed,
        createdAt: { gte: todayStart }
      },
      select: { createdAt: true }
    });

    let chartData: { name: string; value: number }[] = [];

    if (dealsToday.length > 0) {
      // Group by 24 hours
      const hoursMap = new Map<number, number>();
      for (let i = 0; i < 24; i++) hoursMap.set(i, 0);
      dealsToday.forEach(deal => {
        const h = deal.createdAt.getHours();
        hoursMap.set(h, hoursMap.get(h)! + 1);
      });
      for (let i = 0; i < 24; i++) {
        chartData.push({ name: `${i}:00`, value: hoursMap.get(i)! });
      }
    } else {
      // Fallback to 24 days
      const twentyFourDaysAgo = new Date(todayStart);
      twentyFourDaysAgo.setDate(twentyFourDaysAgo.getDate() - 23);
      
      const recentDeals = await prisma.deal.findMany({
        where: {
          status: DealStatus.completed,
          createdAt: { gte: twentyFourDaysAgo }
        },
        select: { createdAt: true }
      });

      if (recentDeals.length > 0) {
        const daysMap = new Map<string, number>();
        for (let i = 23; i >= 0; i--) {
          const d = new Date(todayStart);
          d.setDate(d.getDate() - i);
          daysMap.set(d.toISOString().split('T')[0], 0);
        }
        recentDeals.forEach(deal => {
          const dateStr = deal.createdAt.toISOString().split('T')[0];
          if (daysMap.has(dateStr)) {
            daysMap.set(dateStr, daysMap.get(dateStr)! + 1);
          }
        });
        chartData = Array.from(daysMap.entries()).map(([date, count]) => ({
          name: date.slice(8, 10), // just day of month
          value: count
        }));
      } else {
        // Mock data
        const mockValues = Array(24).fill(0);
        for (let i = 23; i >= 0; i--) {
          const d = new Date(todayStart);
          d.setDate(d.getDate() - i);
          chartData.push({
            name: d.toISOString().split('T')[0].slice(8, 10),
            value: mockValues[23 - i]
          });
        }
      }
    }

    const publicReviewer = latestReview
      ? toPublicReviewUser(latestReview.reviewer)
      : null;
    const formattedReview =
      latestReview && publicReviewer
        ? {
            id: latestReview.id,
            dealId: latestReview.dealId,
            reviewerId: latestReview.reviewerId,
            reviewedUserId: latestReview.reviewedUserId,
            rating: latestReview.rating,
            comment: latestReview.comment,
            createdAt: latestReview.createdAt.toISOString(),
            reviewer: {
              id: publicReviewer.id,
              name:
                publicReviewer.name ||
                [publicReviewer.telegramFirstName, publicReviewer.telegramLastName]
                  .filter(Boolean)
                  .join(" ") ||
                "Favor user",
              telegramUsername: publicReviewer.telegramUsername,
              avatarUrl: buildTelegramAvatarProxyUrl(publicReviewer.telegramId),
            },
          }
        : null;

    return {
      totalContracts,
      totalViews,
      totalDeals,
      chartData,
      latestReview: formattedReview,
    };
  } catch {
    return {
      totalContracts: 0,
      totalViews: 0,
      totalDeals: 0,
      chartData: [],
      latestReview: null,
    };
  }
}

export type PlatformStats = Awaited<ReturnType<typeof getPlatformStats>>;

export async function getPopularContracts(): Promise<ContractDto[]> {
  if (!process.env.DATABASE_URL) {
    return [];
  }

  try {
    const contracts = await prisma.contract.findMany({
      where: { status: ContractStatus.active },
      select: popularContractSelect,
    });

    if (contracts.length === 0) {
      return [];
    }

    const contractIds = contracts.map((contract) => contract.id);
    const [viewGroups, completedDealGroups, reviews] = await prisma.$transaction([
      prisma.contractView.groupBy({
        by: ["contractId"],
        orderBy: { contractId: "asc" },
        where: { contractId: { in: contractIds } },
        _count: { contractId: true },
      }),
      prisma.deal.groupBy({
        by: ["contractId"],
        orderBy: { contractId: "asc" },
        where: { contractId: { in: contractIds }, status: DealStatus.completed },
        _count: { contractId: true },
      }),
      prisma.review.findMany({
        where: {
          deal: {
            contractId: { in: contractIds },
            status: DealStatus.completed,
          },
        },
        select: {
          rating: true,
          deal: { select: { contractId: true } },
        },
      }),
    ]);

    const getGroupedContractCount = (
      group: { contractId: number | null; _count?: true | { contractId?: number | null } | null },
    ) => {
      if (!group._count || group._count === true) return 0;
      return group._count.contractId ?? 0;
    };

    const viewsByContractId = new Map(
      viewGroups.map((group) => [group.contractId, getGroupedContractCount(group)]),
    );
    const completedDealsByContractId = new Map(
      completedDealGroups
        .filter((group) => group.contractId !== null)
        .map((group) => [group.contractId as number, getGroupedContractCount(group)]),
    );
    const reviewAggregateByContractId = new Map<number, { totalRating: number; reviewsCount: number }>();

    for (const review of reviews) {
      if (review.deal.contractId !== null) {
        const current = reviewAggregateByContractId.get(review.deal.contractId) ?? {
          totalRating: 0,
          reviewsCount: 0,
        };
        current.totalRating += review.rating;
        current.reviewsCount += 1;
        reviewAggregateByContractId.set(review.deal.contractId, current);
      }
    }

    return contracts
      .map((contract) => {
        const reviewAggregate = reviewAggregateByContractId.get(contract.id);
        const completedDealsCount = completedDealsByContractId.get(contract.id) ?? 0;

        return toPublicPopularContract(contract, {
          uniqueViewsCount: viewsByContractId.get(contract.id) ?? 0,
          completedDealsCount,
          averageRating: reviewAggregate
            ? reviewAggregate.totalRating / reviewAggregate.reviewsCount
            : null,
          reviewsCount: reviewAggregate?.reviewsCount ?? 0,
        });
      })
      .sort(
        (left, right) =>
          ((right.uniqueViewsCount ?? 0) - (left.uniqueViewsCount ?? 0)) ||
          ((right.completedDealsCount ?? 0) -
            (left.completedDealsCount ?? 0)) ||
          ((right.averageRating ?? -1) - (left.averageRating ?? -1)) ||
          ((right.reviewsCount ?? 0) - (left.reviewsCount ?? 0)) ||
          (new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),
      )
      .slice(0, 3);
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return [];
    }
    throw error;
  }
}
