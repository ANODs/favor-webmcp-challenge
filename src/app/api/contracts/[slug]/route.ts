import {
  ContractStatus,
  ContractType,
  DealStatus,
  EscrowCurrency,
  Prisma,
} from "@prisma/client";

import {
  classifyContractCategory,
  getCategoryLabel,
  resolveCategoryId,
} from "@/entities/category";
import {
  areContractQuestionsEnabled,
  buildContractManagementWriteWhere,
  canManageContract,
  canViewContractAuthorContact,
  buildContractVersionConflictDetails,
  CONTRACT_VERSION_CONFLICT_CODE,
  contractUpdateSchema,
  getContractVersionConflictDetails,
  isUnclaimedScoutContract,
  moderateContractContent,
  type ContractVersionConflictDetails,
} from "@/entities/contract";
import {
  allocateUniqueContractSlug,
  buildContractContentFingerprint,
  revalidateContractPage,
  rethrowContractManagementWriteError,
  serializeContractMutationResponse,
  serializeContractTelegramSourceForViewer,
} from "@/entities/contract/server";
import { OPEN_DEAL_STATUSES } from "@/entities/deal";
import { requireUserCapability } from "@/entities/user/server";
import { validateContractWithAi } from "@/features/contract-ai-moderation";
import { fail, handleRouteError, ok } from "@/shared/lib/api";
import { ApplicationError } from "@/shared/lib/application-error";
import { getCurrentUser } from "@/shared/lib/auth";
import { prisma } from "@/shared/lib/prisma";
import { reviewUserSelect, toPublicReview } from "@/shared/lib/review";
import { notifyContractStatusChanged } from "@/features/contract-notifications";
import { CONTRACT_ERROR_CODES } from "@/shared/config";

type Params = {
  params: Promise<{
    slug: string;
  }>;
};

const contractVersionConflictError = (
  details: ContractVersionConflictDetails,
) =>
  new ApplicationError(
    CONTRACT_VERSION_CONFLICT_CODE,
    "This contract was changed in another session. Review the latest version before saving.",
    409,
    details,
  );

export async function GET(request: Request, { params }: Params) {
  try {
    const userLocale = request.headers.get("cookie")?.match(/NEXT_LOCALE=(ru|en)/)?.[1] || "ru";
    const trackView = new URL(request.url).searchParams.get("trackView") !== "false";
    const user = await getCurrentUser();
    const { slug } = await params;

    const contract = await prisma.contract.findUnique({
      where: { slug },
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
        reveals: user
          ? {
              where: { userId: user.id },
            }
          : false,
      },
    });

    if (!contract) {
      throw new Error("NOT_FOUND");
    }

    const isAuthor = user?.id === contract.authorId;
    const isScout = user?.id === contract.scoutId;
    const isModerator = user?.role === "moderator";
    const canSeeUnpublished =
      isAuthor || isScout || isModerator;

    if (contract.status !== ContractStatus.active && !canSeeUnpublished) {
      throw new Error("FORBIDDEN");
    }

    // Image updates are now handled asynchronously by the client

    if (trackView && user && user.id !== contract.authorId) {
      await prisma.contractView.upsert({
        where: {
          contractId_userId: {
            contractId: contract.id,
            userId: user.id,
          },
        },
        update: {},
        create: {
          contractId: contract.id,
          userId: user.id,
        },
      });
    }

    const [uniqueViewsCount, completedDealsCount, ratingAggregate, reviews] =
      await prisma.$transaction([
        prisma.contractView.count({
          where: { contractId: contract.id },
        }),
        prisma.deal.count({
          where: {
            contractId: contract.id,
            status: DealStatus.completed,
          },
        }),
        prisma.review.aggregate({
          where: {
            deal: {
              contractId: contract.id,
              status: DealStatus.completed,
            },
          },
          _avg: {
            rating: true,
          },
          _count: {
            rating: true,
          },
        }),
        prisma.review.findMany({
          where: {
            deal: {
              contractId: contract.id,
              status: DealStatus.completed,
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          include: {
            reviewer: {
              select: reviewUserSelect,
            },
            reviewedUser: {
              select: reviewUserSelect,
            },
          },
        }),
      ]);

    const hasRevealed = contract.reveals && contract.reveals.length > 0;

    const isRevealed = canViewContractAuthorContact(
      contract,
      user,
      hasRevealed,
    );

    const sanitizedContract = serializeContractTelegramSourceForViewer(
      contract,
      user,
      { revealTelegramLinks: Boolean(isRevealed) },
    );

    // Scrub private details if not revealed
    if (!isRevealed) {
      if (sanitizedContract.author) {
        sanitizedContract.author = {
          ...sanitizedContract.author,
          name: null,
          telegramUsername: null,
        };
      }
      if (sanitizedContract.scout) {
        sanitizedContract.scout = {
          ...sanitizedContract.scout,
          name: null,
          telegramUsername: null,
        };
      }
    } else {
      if (sanitizedContract.author && sanitizedContract.author.isTelegramUsernameHidden && !isAuthor && !isModerator) {
        sanitizedContract.author = { ...sanitizedContract.author, telegramUsername: null };
      }
      if (sanitizedContract.scout && sanitizedContract.scout.isTelegramUsernameHidden && !isAuthor && !isModerator) {
        sanitizedContract.scout = { ...sanitizedContract.scout, telegramUsername: null };
      }
    }

    const fallbackTitle = sanitizedContract.titleRu || sanitizedContract.titleEn || "";
    const fallbackDescription = sanitizedContract.descriptionRu || sanitizedContract.descriptionEn || "";
    const title = userLocale === "en" ? (sanitizedContract.titleEn || fallbackTitle) : (sanitizedContract.titleRu || fallbackTitle);
    const description = userLocale === "en" ? (sanitizedContract.descriptionEn || fallbackDescription) : (sanitizedContract.descriptionRu || fallbackDescription);

    return ok({
      ...sanitizedContract,
      title,
      description,
      uniqueViewsCount,
      completedDealsCount,
      averageRating: ratingAggregate._avg.rating ?? null,
      reviewsCount: ratingAggregate._count.rating,
      reviews: reviews.map(toPublicReview),
      isRevealed: Boolean(isRevealed),
      questionsEnabled: areContractQuestionsEnabled(sanitizedContract),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const user = await requireUserCapability("contract:publish");
    const { slug } = await params;
    const payload = contractUpdateSchema.parse(await request.json());

    const existing = await prisma.contract.findUnique({
      where: { id: payload.contractId },
    });

    if (!existing) {
      throw new Error("NOT_FOUND");
    }

    if (!canManageContract(existing, user)) {
      throw new Error("FORBIDDEN");
    }

    const conflict = getContractVersionConflictDetails(
      {
        contractId: payload.contractId,
        slug,
        baseUpdatedAt: payload.baseUpdatedAt,
      },
      existing,
    );
    if (conflict) {
      throw contractVersionConflictError(conflict);
    }

    const categoryCandidate =
      payload.category === undefined ? existing.category : payload.category;
    const resolvedCategory = resolveCategoryId(categoryCandidate);
    if (payload.category && !resolvedCategory) {
      return fail("Select a category from the Favor catalog.", 400, {
        code: CONTRACT_ERROR_CODES.categoryUnknown,
        category: "UNKNOWN_CATEGORY",
      });
    }
    const classifiedCategory = resolvedCategory
      ? null
      : classifyContractCategory({
          titleRu: payload.titleRu === undefined ? existing.titleRu : payload.titleRu,
          titleEn: payload.titleEn === undefined ? existing.titleEn : payload.titleEn,
          descriptionRu:
            payload.descriptionRu === undefined ? existing.descriptionRu : payload.descriptionRu,
          descriptionEn:
            payload.descriptionEn === undefined ? existing.descriptionEn : payload.descriptionEn,
          tags: payload.tags ?? existing.tags,
        });
    const nextCategory =
      resolvedCategory ?? classifiedCategory?.categoryId ?? "other.manual";
    const categoryLabel = getCategoryLabel(nextCategory, "ru") ?? nextCategory;
    const moderation = moderateContractContent({
      title: payload.titleRu || payload.titleEn || "",
      description: payload.descriptionRu || payload.descriptionEn || "",
      category: categoryLabel,
      tagsInput: payload.tags?.join(", "),
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

    const fallbackTitlePayload = payload.titleRu || payload.titleEn;
    const fallbackTitleExisting = existing.titleRu || existing.titleEn || "";
    
    const aiModeration = await validateContractWithAi({
      title: fallbackTitlePayload ?? fallbackTitleExisting,
      description: payload.descriptionRu || payload.descriptionEn || existing.descriptionRu || existing.descriptionEn || "",
      category: categoryLabel,
      tags: payload.tags ?? existing.tags,
      type: payload.type ?? existing.type,
      cachedTelegramText:
        payload.cachedTelegramText === undefined
          ? existing.cachedTelegramText
          : payload.cachedTelegramText,
    });

    const isUnclaimedScout = isUnclaimedScoutContract(existing);
    const nextIsEscrow =
      payload.isEscrow === undefined
        ? existing.isEscrow
        : isUnclaimedScout
          ? false
          : payload.isEscrow;
    const nextEscrowCurrency = nextIsEscrow
      ? (payload.escrowCurrency ?? existing.escrowCurrency)
      : EscrowCurrency.TON;
    const contentFingerprint = buildContractContentFingerprint({
      titleRu: payload.titleRu === undefined ? existing.titleRu : payload.titleRu,
      titleEn: payload.titleEn === undefined ? existing.titleEn : payload.titleEn,
      descriptionRu:
        payload.descriptionRu === undefined ? existing.descriptionRu : payload.descriptionRu,
      descriptionEn:
        payload.descriptionEn === undefined ? existing.descriptionEn : payload.descriptionEn,
      category: nextCategory,
      tags: payload.tags ?? existing.tags,
    });

    const updated = await prisma.$transaction(async (tx) => {
      const slugResult =
        fallbackTitlePayload &&
        fallbackTitlePayload.trim() !== fallbackTitleExisting
          ? await allocateUniqueContractSlug(
              tx,
              fallbackTitlePayload,
              existing.id,
            )
          : null;

      if (slugResult && !slugResult.ok) {
        throw new Error(slugResult.reason);
      }

      return tx.contract
        .update({
          where: {
            ...buildContractManagementWriteWhere(existing.id, user),
            updatedAt: existing.updatedAt,
          },
          data: {
            titleRu:
              payload.titleRu === undefined
                ? undefined
                : payload.titleRu?.trim() || null,
            titleEn:
              payload.titleEn === undefined
                ? undefined
                : payload.titleEn?.trim() || null,
            slug: slugResult?.ok ? slugResult.slug : undefined,
            descriptionRu:
              payload.descriptionRu === undefined
                ? undefined
                : payload.descriptionRu?.trim() || null,
            descriptionEn:
              payload.descriptionEn === undefined
                ? undefined
                : payload.descriptionEn?.trim() || null,
            type: payload.type,
            isEscrow:
              payload.isEscrow === undefined ? undefined : nextIsEscrow,
            escrowCurrency:
              payload.escrowCurrency === undefined &&
              payload.isEscrow === undefined
                ? undefined
                : nextEscrowCurrency,
            category: nextCategory,
            tags: payload.tags?.map((tag) => tag.trim().toLowerCase()),
            basePrice:
              payload.basePrice === undefined ? undefined : payload.basePrice,
            deadlineDays:
              payload.deadlineDays === undefined
                ? undefined
                : payload.deadlineDays,
            maxOpenDeals:
              payload.maxOpenDeals === undefined
                ? undefined
                : payload.type === ContractType.order ||
                    (payload.type === undefined &&
                      existing.type === ContractType.order)
                  ? 1
                  : payload.maxOpenDeals,
            telegramPostUrl:
              payload.telegramPostUrl === undefined
                ? undefined
                : payload.telegramPostUrl,
            telegramChannelUrl:
              payload.telegramChannelUrl === undefined
                ? undefined
                : payload.telegramChannelUrl,
            cachedTelegramText:
              payload.cachedTelegramText === undefined
                ? undefined
                : payload.cachedTelegramText,
            mediaRefs:
              payload.mediaRefs === undefined ? undefined : payload.mediaRefs ?? [],
            contentFingerprint,
            status: ContractStatus.pending_moderation,
            moderationComment: null,
            ogImageBase64: null,
            aiModerationSummary: aiModeration?.shortDescription ?? null,
            aiRiskFactor: aiModeration?.riskFactor ?? null,
          },
          include: {
            author: { select: { id: true, telegramId: true } },
            scout: { select: { id: true, telegramId: true } },
          },
        })
        .catch(async (error: unknown) => {
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === "P2025"
          ) {
            const latest = await tx.contract.findUnique({
              where: { id: existing.id },
              select: {
                id: true,
                slug: true,
                updatedAt: true,
                authorId: true,
              },
            });

            if (!latest) {
              throw new Error("NOT_FOUND");
            }

            if (!canManageContract(latest, user)) {
              throw new Error("FORBIDDEN");
            }

            throw contractVersionConflictError(
              buildContractVersionConflictDetails(latest),
            );
          }

          return rethrowContractManagementWriteError(error);
        });
    });

    await notifyContractStatusChanged({
      contract: updated,
      previousStatus: existing.status,
    });

    revalidateContractPage(existing.slug);
    if (updated.slug !== existing.slug) {
      revalidateContractPage(updated.slug);
    }

    return ok(serializeContractMutationResponse(updated));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const user = await requireUserCapability("contract:publish");
    const { slug } = await params;

    const existing = await prisma.contract.findUnique({
      where: { slug },
      select: { id: true, authorId: true, status: true },
    });

    if (!existing) {
      throw new Error("NOT_FOUND");
    }

    if (!canManageContract(existing, user)) {
      throw new Error("FORBIDDEN");
    }

    const archived = await prisma.contract
      .update({
        where: buildContractManagementWriteWhere(existing.id, user),
        data: { status: ContractStatus.archived },
        include: {
          author: { select: { id: true, telegramId: true } },
          scout: { select: { id: true, telegramId: true } },
        },
      })
      .catch(rethrowContractManagementWriteError);

    await notifyContractStatusChanged({
      contract: archived,
      previousStatus: existing.status,
    });

    revalidateContractPage(slug);

    return ok(serializeContractMutationResponse(archived));
  } catch (error) {
    return handleRouteError(error);
  }
}
