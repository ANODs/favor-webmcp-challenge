import { ContractStatus, ContractType, DealStatus, EscrowCurrency, Prisma } from "@prisma/client";

import {
  classifyContractCategory,
  getCategoryAliases,
  getCategoryLabel,
  resolveCategoryId,
} from "@/entities/category";
import {
  canManageContract,
  CONTRACT_FEED_PAGE_SIZE,
  contractInputSchema,
  paginateContractFeed,
  parseContractFeedCursor,
  resolveActiveContractAuthorScope,
} from "@/entities/contract";
import {
  allocateUniqueContractSlug,
  buildContractContentFingerprint,
  serializeContractScoutForFeedViewer,
  serializeContractTelegramSourceForViewer,
} from "@/entities/contract/server";
import { OPEN_DEAL_STATUSES } from "@/entities/deal";
import {
  assertTelegramBotWriteAccess,
  requireTelegramUserCapability,
} from "@/entities/user/server";
import {
  completeContractPublicationDraft,
  reserveContractPublicationDraft,
  resolveContractPublicationDraftForPublishing,
} from "@/features/create-contract/server";
import {
  CONTRACT_MODERATION_RATING_SCAN_SIZE,
  CONTRACT_MODERATION_QUEUE_FILTER,
  listContractModerationCandidates,
  paginateContractModerationResults,
  validateContractWithAi,
  type ContractModerationSort,
  type ContractModerationSortOrder,
} from "@/features/contract-ai-moderation/server";
import { ensureContractReferralForInvitedAuthor } from "@/features/contract-referrals/server";
import { fail, handleRouteError, ok } from "@/shared/lib/api";
import { getCurrentUser } from "@/shared/lib/auth";
import { moderateContractContent } from "@/entities/contract";
import { prisma } from "@/shared/lib/prisma";
import { enforceRateLimit } from "@/shared/lib/rate-limit";
import { hashRequestIp } from "@/shared/lib/request-ip";
import {
  checkContractLimit,
  hasUnlimitedContractPublishing,
} from "@/shared/lib/contract-limits";
import { httpHeaders } from "@/shared/constants/http-headers";
import { CONTRACT_ERROR_CODES } from "@/shared/config";

const PUBLIC_AGENT_SEARCH_CANDIDATE_LIMIT = 100;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userLocale = request.headers.get("cookie")?.match(/NEXT_LOCALE=(ru|en)/)?.[1] || "ru";
    const moderationScope = searchParams.get("moderation") === "true";
    const user = await getCurrentUser();
    const isModerator = user?.role === "moderator";

    if (moderationScope && !isModerator) {
      throw new Error("FORBIDDEN");
    }

    const activeAuthorScope = moderationScope
      ? null
      : resolveActiveContractAuthorScope(searchParams.get("activeAuthorId"));
    const search = searchParams.get("search")?.trim();
    const requestedCategory = searchParams.get("category")?.trim();
    const category = resolveCategoryId(requestedCategory);
    const type = searchParams.get("type") as ContractType | null;
    const rawStatus = searchParams.get("status");
    const moderationQueueOnly =
      moderationScope && rawStatus === CONTRACT_MODERATION_QUEUE_FILTER;
    const statusParam = moderationQueueOnly
      ? null
      : rawStatus as ContractStatus | null;
    const minPrice = searchParams.get("minPrice") ? Number(searchParams.get("minPrice")) : null;
    const maxPrice = searchParams.get("maxPrice") ? Number(searchParams.get("maxPrice")) : null;
    const minDeadline = searchParams.get("minDeadline") ? Number(searchParams.get("minDeadline")) : null;
    const maxDeadline = searchParams.get("maxDeadline") ? Number(searchParams.get("maxDeadline")) : null;
    const minRating = searchParams.get("minRating") ? Number(searchParams.get("minRating")) : null;
    const period = searchParams.get("period");
    const isEscrowParam = searchParams.get("isEscrow");
    const sortBy = searchParams.get("sortBy") as "price" | "deals" | null;
    const sortOrder = (searchParams.get("sortOrder") as "asc" | "desc") || "desc";
    const rawCursor = searchParams.get("cursor");
    const cursor = moderationScope
      ? undefined
      : parseContractFeedCursor(rawCursor);

    const onlyMine = searchParams.get("mine") === "true";
    const publicOnly = searchParams.get("publicOnly") === "true";
    const hideScouted = searchParams.get("hideScouted") === "true";
    const onlyFavorites = !activeAuthorScope && searchParams.get("favorites") === "true";

    const responseViewer = activeAuthorScope ? null : user;
    const requestedStatus = activeAuthorScope
      ? ContractStatus.active
      : statusParam ?? (onlyMine || isModerator ? undefined : ContractStatus.active);

    if (publicOnly) {
      if (!search || search.length < 2) {
        return fail("Public agent search requires at least two characters.", 400, {
          code: "PUBLIC_SEARCH_QUERY_REQUIRED",
        });
      }
      await enforceRateLimit({
        key: `contract:public-agent-search:minute:${hashRequestIp(request)}`,
        limit: 30,
        windowMs: 60 * 1000,
      });
    }

    const ownStatuses = new Set<ContractStatus>([
      ContractStatus.archived,
      ContractStatus.pending_moderation,
      ContractStatus.rejected,
      ContractStatus.limit_reached,
    ]);
    const ownScopeRequired = !activeAuthorScope && !publicOnly && (
      onlyMine || (!!requestedStatus && !isModerator && ownStatuses.has(requestedStatus))
    );
    const moderationQueueStatuses = moderationQueueOnly
      ? {
          in: [ContractStatus.pending_moderation, ContractStatus.active],
        }
      : undefined;

    if ((ownScopeRequired || onlyFavorites) && !user) {
      return ok({ items: [], nextCursor: null });
    }

    if (
      requestedStatus &&
      !isModerator &&
      requestedStatus !== ContractStatus.active &&
      !ownStatuses.has(requestedStatus)
    ) {
      return ok({ items: [], nextCursor: null });
    }

    if (requestedCategory && !category) {
      return ok({ items: [], nextCursor: null });
    }

    const where: Prisma.ContractWhereInput = {
      ...(activeAuthorScope ?? {}),
      type: type ?? undefined,
      category: category
        ? { in: [...getCategoryAliases(category)], mode: "insensitive" }
        : undefined,
    };

    if (!activeAuthorScope) {
      if (publicOnly) {
        where.status = ContractStatus.active;
      } else if (ownScopeRequired) {
        where.authorId = user?.id;
        where.status = requestedStatus ?? moderationQueueStatuses;
      } else if (isModerator) {
        where.status = requestedStatus ?? moderationQueueStatuses;
      } else if (user && requestedStatus === ContractStatus.active) {
        where.OR = [
          { status: ContractStatus.active },
          { authorId: user.id },
        ];
      } else {
        where.status = requestedStatus;
      }
    }

    if (isEscrowParam === "true") {
      where.isEscrow = true;
    } else if (isEscrowParam === "false") {
      where.isEscrow = false;
    }

    if (hideScouted) {
      where.scoutId = null;
    }

    if (onlyFavorites && user) {
      where.favoritedBy = {
        some: { userId: user.id },
      };
    }

    if (search) {
      const searchCondition: Prisma.ContractWhereInput = {
        OR: [
          { titleRu: { contains: search, mode: "insensitive" } },
          { titleEn: { contains: search, mode: "insensitive" } },
          { descriptionRu: { contains: search, mode: "insensitive" } },
          { descriptionEn: { contains: search, mode: "insensitive" } },
          { tags: { has: search.toLowerCase() } },
        ]
      };

      if (where.OR) {
        where.AND = [
          { OR: where.OR },
          searchCondition
        ];
        delete where.OR;
      } else {
        where.OR = searchCondition.OR;
      }
    }

    if (minPrice !== null || maxPrice !== null) {
      where.basePrice = {};
      if (minPrice !== null) where.basePrice.gte = minPrice;
      if (maxPrice !== null) where.basePrice.lte = maxPrice;
    }

    if (minDeadline !== null || maxDeadline !== null) {
      where.deadlineDays = {};
      if (minDeadline !== null) where.deadlineDays.gte = minDeadline;
      if (maxDeadline !== null) where.deadlineDays.lte = maxDeadline;
    }

    if (period) {
      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;
      let limitMs = 0;

      if (period === "day") limitMs = dayMs;
      if (period === "week") limitMs = 7 * dayMs;
      if (period === "month") limitMs = 30 * dayMs;

      if (limitMs > 0) {
        where.createdAt = { gte: new Date(now - limitMs) };
      }
    }

    const moderationSort: ContractModerationSort = sortBy ?? "createdAt";
    const moderationSortOrder: ContractModerationSortOrder =
      moderationSort === "createdAt" ? "asc" : sortOrder;
    const moderationCandidatePage = moderationScope
      ? await listContractModerationCandidates({
          where,
          rawCursor,
          sort: moderationSort,
          order: moderationSortOrder,
          take: minRating === null
            ? CONTRACT_FEED_PAGE_SIZE
            : CONTRACT_MODERATION_RATING_SCAN_SIZE,
        })
      : null;

    if (moderationCandidatePage?.candidates.length === 0) {
      return ok({ items: [], nextCursor: null });
    }

    const contractRecords = await prisma.contract.findMany({
      where: moderationCandidatePage
        ? {
            AND: [
              where,
              {
                id: {
                  in: moderationCandidatePage.candidates.map(
                    (candidate) => candidate.id,
                  ),
                },
              },
            ],
          }
        : where,
      take: moderationCandidatePage
        ? undefined
        : publicOnly
          ? PUBLIC_AGENT_SEARCH_CANDIDATE_LIMIT
          : undefined,
      orderBy: moderationCandidatePage
        ? undefined
        : sortBy === "price"
          ? [{ basePrice: sortOrder }, { createdAt: "desc" }, { id: "desc" }]
          : [{ createdAt: "desc" }, { id: "desc" }],
      include: {
        author: {
          select: {
            id: true,
            name: true,
            role: true,
            rating: true,
            telegramUsername: true,
            isTelegramUsernameHidden: true,
          },
        },
        scout: {
          select: {
            id: true,
            name: true,
            role: true,
            rating: true,
            telegramUsername: true,
            isTelegramUsernameHidden: true,
          },
        },
        _count: {
          select: {
            deals: {
              where: {
                status: { in: OPEN_DEAL_STATUSES },
              },
            },
          },
        },
        favoritedBy: {
          where: { userId: responseViewer?.id ?? -1 },
          select: { userId: true },
          take: 1,
        },
      },
    });
    const contractsById = new Map(
      contractRecords.map((contract) => [contract.id, contract]),
    );
    const contracts = moderationCandidatePage
      ? moderationCandidatePage.candidates.flatMap((candidate) => {
          const contract = contractsById.get(candidate.id);
          return contract ? [contract] : [];
        })
      : contractRecords;

    if (contracts.length === 0) {
      return ok(
        moderationCandidatePage
          ? paginateContractModerationResults(
              [],
              moderationCandidatePage.candidates,
              moderationCandidatePage.hasMore,
              moderationSortOrder,
              CONTRACT_FEED_PAGE_SIZE,
            )
          : { items: [], nextCursor: null },
      );
    }

    const contractIds = contracts.map((contract) => contract.id);

    const [viewGroups, completedDealGroups, reviewAggregates] = await prisma.$transaction([
      prisma.contractView.groupBy({
        by: ["contractId"],
        orderBy: {
          contractId: "asc",
        },
        where: {
          contractId: {
            in: contractIds,
          },
        },
        _count: {
          contractId: true,
        },
      }),
      prisma.deal.groupBy({
        by: ["contractId"],
        orderBy: {
          contractId: "asc",
        },
        where: {
          contractId: {
            in: contractIds,
          },
          status: DealStatus.completed,
        },
        _count: {
          contractId: true,
        },
      }),
      prisma.$queryRaw<Array<{
        contractId: number;
        averageRating: number;
        reviewsCount: number;
      }>>(Prisma.sql`
        SELECT
          deal."contractId" AS "contractId",
          AVG(review."rating")::double precision AS "averageRating",
          COUNT(review."id")::integer AS "reviewsCount"
        FROM "Review" AS review
        INNER JOIN "Deal" AS deal ON deal."id" = review."dealId"
        WHERE deal."contractId" IN (${Prisma.join(contractIds)})
          AND deal."status" = ${DealStatus.completed}::"DealStatus"
        GROUP BY deal."contractId"
      `),
    ]);

    const getGroupedContractCount = (
      group: { contractId: number | null; _count?: true | { contractId?: number | null } | null },
    ) => {
      if (!group._count || group._count === true) {
        return 0;
      }

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
    const reviewAggregateByContractId = new Map(
      reviewAggregates.map((aggregate) => [aggregate.contractId, aggregate]),
    );

    const result = contracts.map((contract) => {
      const { favoritedBy, ...contractData } = contract;
      const reviewAggregate = reviewAggregateByContractId.get(contract.id);

      // Note: we don't fetch isRevealed in the feed to keep it fast.
      // The feed shouldn't show contacts anyway until opened in detailed view.
      const canSeePrivateDetails = canManageContract(contract, responseViewer);

      const fallbackTitle = contract.titleRu || contract.titleEn || "";
      const fallbackDescription = contract.descriptionRu || contract.descriptionEn || "";
      const title = userLocale === "en" ? (contract.titleEn || fallbackTitle) : (contract.titleRu || fallbackTitle);
      const description = userLocale === "en" ? (contract.descriptionEn || fallbackDescription) : (contract.descriptionRu || fallbackDescription);

      return {
        ...serializeContractTelegramSourceForViewer(contractData, responseViewer),
        title,
        description,
        isFavorite: favoritedBy.length > 0,
        author: {
          ...contract.author,
          name: canSeePrivateDetails ? contract.author.name : null,
          telegramUsername: canSeePrivateDetails && !contract.author.isTelegramUsernameHidden ? contract.author.telegramUsername : null,
        },
        scout: serializeContractScoutForFeedViewer(contract.scout, responseViewer),
        uniqueViewsCount: viewsByContractId.get(contract.id) ?? 0,
        completedDealsCount: completedDealsByContractId.get(contract.id) ?? 0,
        averageRating: reviewAggregate?.averageRating ?? null,
        reviewsCount: reviewAggregate?.reviewsCount ?? 0,
      };
    });

    let finalResult = result;

    if (minRating !== null) {
      finalResult = finalResult.filter((contract) => {
        const contractRating = contract.averageRating;
        
        return contractRating !== null && contractRating >= minRating;
      });
    }

    if (sortBy === "deals" && !moderationScope) {
      finalResult.sort((a, b) => {
        const aCount = a._count?.deals ?? 0;
        const bCount = b._count?.deals ?? 0;
        return sortOrder === "asc" ? aCount - bCount : bCount - aCount;
      });
    }

    // Promotion affects only an explicitly selected category. The general feed
    // retains its existing ordering and cursor behavior.
    if (category && !moderationScope) {
      const promotion = await prisma.categoryPromotion.findFirst({
        where: {
          categoryKey: category,
          startsAt: { lte: new Date() },
          endsAt: { gt: new Date() },
          assignedContractId: { not: null },
        },
        orderBy: { startsAt: "desc" },
        select: { assignedContractId: true },
      });
      if (promotion?.assignedContractId) {
        finalResult = [...finalResult].sort((left, right) =>
          left.id === promotion.assignedContractId
            ? -1
            : right.id === promotion.assignedContractId
              ? 1
              : 0,
        );
      }
    }

    return ok(
      moderationCandidatePage
        ? paginateContractModerationResults(
            finalResult,
            moderationCandidatePage.candidates,
            moderationCandidatePage.hasMore,
            moderationSortOrder,
            CONTRACT_FEED_PAGE_SIZE,
          )
        : paginateContractFeed(finalResult, cursor),
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireTelegramUserCapability(
      request,
      "contract:publish",
    );
    const publicationDraftToken = request.headers
      .get(httpHeaders.contractPublicationDraft)
      ?.trim();
    const publicationDraft = publicationDraftToken
      ? await resolveContractPublicationDraftForPublishing({
          token: publicationDraftToken,
          userId: user.id,
        })
      : null;

    if (publicationDraft?.status === "published") {
      return ok(publicationDraft.contract);
    }

    if (!hasUnlimitedContractPublishing(user.role)) {
      await Promise.all([
        enforceRateLimit({
          key: `contract:create:burst:${user.id}`,
          limit: 3,
          windowMs: 10 * 60 * 1000,
        }),
        enforceRateLimit({
          key: `contract:create:day:${user.id}`,
          limit: user.isPremium ? 50 : 10,
          windowMs: 24 * 60 * 60 * 1000,
        }),
      ]);
    }
    const parsedPayload = contractInputSchema.parse(await request.json());
    const requestedCategoryId = resolveCategoryId(parsedPayload.category);
    if (parsedPayload.category && !requestedCategoryId) {
      return fail("Select a category from the Favor catalog.", 400, {
        code: CONTRACT_ERROR_CODES.categoryUnknown,
        category: "UNKNOWN_CATEGORY",
      });
    }
    if (!requestedCategoryId && !parsedPayload.isScouting) {
      return fail("Select a category.", 400, {
        code: CONTRACT_ERROR_CODES.categoryRequired,
        category: "CATEGORY_REQUIRED",
      });
    }
    const classifiedCategory = requestedCategoryId
      ? null
      : classifyContractCategory({
          titleRu: parsedPayload.titleRu,
          titleEn: parsedPayload.titleEn,
          descriptionRu: parsedPayload.descriptionRu,
          descriptionEn: parsedPayload.descriptionEn,
          tags: parsedPayload.tags,
        });
    const payload = {
      ...parsedPayload,
      category: requestedCategoryId ?? classifiedCategory?.categoryId ?? "other.manual",
    };
    const categoryLabel = getCategoryLabel(payload.category, "ru") ?? payload.category;
    const contentFingerprint = buildContractContentFingerprint(payload);
    const duplicateContract = await prisma.contract.findFirst({
      where: {
        authorId: user.id,
        contentFingerprint,
        createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      select: { id: true },
    });

    if (duplicateContract) {
      return fail(
        "An identical contract was already submitted in the last 24 hours.",
        409,
        { code: CONTRACT_ERROR_CODES.duplicateRecent },
      );
    }

    const limitCheck = await checkContractLimit(
      user.id,
      user.isPremium,
      !!payload.isScouting,
      user.role,
    );
    if (!limitCheck.allowed) {
      return fail(limitCheck.error, limitCheck.status, {
        code: limitCheck.code,
        ...limitCheck.details,
      });
    }

    const moderation = moderateContractContent({
      title: payload.titleRu || payload.titleEn || "",
      description: payload.descriptionRu || payload.descriptionEn || "",
      category: categoryLabel,
      tagsInput: payload.tags.join(", "),
    });

    if (moderation.isBlocked) {
      return fail(
        "Contract content did not pass automated moderation.",
        400,
        {
          code: CONTRACT_ERROR_CODES.contentBlocked,
          ...moderation.fieldErrors,
        },
      );
    }

    if (payload.isScouting && !payload.telegramPostUrl) {
      return fail(
        "A Telegram post link is required for a scouted contract.",
        400,
        { code: CONTRACT_ERROR_CODES.scoutPostRequired },
      );
    }

    const aiModeration = await validateContractWithAi({
      title: payload.titleRu || payload.titleEn || "",
      description: payload.descriptionRu || payload.descriptionEn || "",
      category: categoryLabel,
      tags: payload.tags,
      type: payload.type,
      cachedTelegramText: payload.cachedTelegramText,
    });

    const invitedAuthorReferral = payload.isScouting
      ? null
      : await prisma.user.findUnique({
          where: {
            id: user.id,
          },
          select: {
            referredById: true,
          },
        });

    const isEscrowEnabled = payload.isScouting ? false : (payload.isEscrow ?? true);
    const escrowCurrency = isEscrowEnabled
      ? (payload.escrowCurrency ?? EscrowCurrency.TON)
      : EscrowCurrency.TON;

    await assertTelegramBotWriteAccess(user.telegramId);

    const contract = await prisma.$transaction(async (tx) => {
      const slugResult = await allocateUniqueContractSlug(
        tx,
        payload.titleRu || payload.titleEn || "contract",
      );

      if (!slugResult.ok) {
        throw new Error(slugResult.reason);
      }

      if (publicationDraft?.status === "ready") {
        await reserveContractPublicationDraft(
          tx,
          publicationDraft.id,
          user.id,
        );
      }

      const createdContract = await tx.contract.create({
        data: {
          authorId: user.id,
          titleRu: payload.titleRu?.trim() || null,
          titleEn: payload.titleEn?.trim() || null,
          slug: slugResult.slug,
          descriptionRu: payload.descriptionRu?.trim() || null,
          descriptionEn: payload.descriptionEn?.trim() || null,
          type: payload.type,
          category: payload.category,
          tags: payload.tags.map((tag) => tag.trim().toLowerCase()),
          basePrice: payload.basePrice ?? null,
          deadlineDays: payload.deadlineDays ?? null,
          maxOpenDeals:
            payload.type === ContractType.order ? 1 : (payload.maxOpenDeals !== undefined ? payload.maxOpenDeals : 3),
          status: ContractStatus.pending_moderation,
          isEscrow: isEscrowEnabled,
          escrowCurrency,
          scoutId: payload.isScouting ? user.id : undefined,
          scoutedTelegramUsername: payload.isScouting ? payload.scoutedTelegramUsername : undefined,
          aiModerationSummary: aiModeration?.shortDescription ?? null,
          aiRiskFactor: aiModeration?.riskFactor ?? null,
          telegramPostUrl: payload.telegramPostUrl ?? null,
          telegramChannelUrl: payload.telegramChannelUrl ?? null,
          cachedTelegramText: payload.cachedTelegramText ?? null,
          mediaRefs: payload.mediaRefs ?? [],
          contentFingerprint,
        },
      });

      if (invitedAuthorReferral?.referredById) {
        await ensureContractReferralForInvitedAuthor(tx, {
          contractId: createdContract.id,
          referrerId: invitedAuthorReferral.referredById,
          authorId: user.id,
        });
      }

      if (publicationDraft?.status === "ready") {
        await completeContractPublicationDraft(
          tx,
          publicationDraft.id,
          createdContract.id,
        );
      }

      return createdContract;
    });

    return ok(contract, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
