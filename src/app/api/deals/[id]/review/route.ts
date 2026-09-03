import { DealStatus } from "@prisma/client";
import { z } from "zod";

import { revalidateContractPage } from "@/entities/contract/server";
import { requireUserCapability } from "@/entities/user/server";
import { accrueContractReferralRewardForDeal } from "@/features/contract-referrals/server";
import { notifyDealReviewSaved } from "@/features/deal-notifications";
import { handleRouteError, ok } from "@/shared/lib/api";
import { prisma } from "@/shared/lib/prisma";
import {
  recalculateUserRating,
  reviewUserSelect,
  toPublicReview,
} from "@/shared/lib/review";

const schema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional().nullable(),
});

type Params = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, { params }: Params) {
  try {
    const user = await requireUserCapability("account:write");
    const { id } = await params;
    const payload = schema.parse(await request.json());

    const deal = await prisma.deal.findUnique({
      where: { id: Number(id) },
      include: {
        reviews: true,
      },
    });

    if (!deal) {
      throw new Error("DEAL_NOT_FOUND");
    }

    const isCustomer = deal.customerId === user.id;
    const isFreelancer = deal.freelancerId === user.id;

    if (!isCustomer && !isFreelancer) {
      throw new Error("FORBIDDEN");
    }

    if (deal.status !== DealStatus.awaiting_review && deal.status !== DealStatus.completed) {
      throw new Error("DEAL_REVIEW_NOT_AVAILABLE");
    }

    const reviewedUserId = isCustomer ? deal.freelancerId : deal.customerId;

    const wasCompletedBeforeReview = deal.status === DealStatus.completed;

    const updatedDeal = await prisma.$transaction(async (tx) => {
      await tx.review.upsert({
        where: {
          dealId_reviewerId: {
            dealId: deal.id,
            reviewerId: user.id,
          },
        },
        update: {
          rating: payload.rating,
          comment: payload.comment?.trim() || null,
        },
        create: {
          dealId: deal.id,
          reviewerId: user.id,
          reviewedUserId,
          rating: payload.rating,
          comment: payload.comment?.trim() || null,
        },
      });

      if (isCustomer) {
        await tx.deal.update({
          where: { id: deal.id },
          data: { reviewLeftByCustomer: true },
        });
      }

      await recalculateUserRating(tx, reviewedUserId);

      const reviewsCount = await tx.review.count({
        where: { dealId: deal.id },
      });

      let becameCompleted = false;

      if (reviewsCount >= 2 && deal.status !== DealStatus.completed) {
        const completedAt = new Date();
        const startedAtTime = (deal.plannedStartedAt ?? deal.createdAt).getTime();
        const durationMinutes = Math.max(1, Math.round((completedAt.getTime() - startedAtTime) / (60 * 1000)));

        await tx.deal.update({
          where: { id: deal.id },
          data: {
            status: DealStatus.completed,
            completedAt,
            actualDurationMinutes: durationMinutes,
          },
        });

        becameCompleted = true;

        if (deal.contractId) {
          const contract = await tx.contract.findUnique({
            where: { id: deal.contractId },
            select: { id: true, status: true, maxOpenDeals: true }
          });
          
          if (contract && contract.status === "limit_reached") {
            const openDealsCount = await tx.deal.count({
              where: {
                contractId: contract.id,
                status: {
                  in: [
                    "pending_approval",
                    "in_progress",
                    "work_completed_by_freelancer",
                    "paid_by_customer",
                    "payment_received_by_freelancer",
                    "result_sent_by_freelancer",
                    "result_received_by_customer",
                    "revision_requested",
                    "awaiting_review",
                    "cancellation_requested",
                  ]
                }
              }
            });

            if (contract.maxOpenDeals === null || openDealsCount < contract.maxOpenDeals) {
              await tx.contract.update({
                where: { id: contract.id },
                data: { status: "active" }
              });
            }
          }
        }
      }

      if (becameCompleted || deal.status === DealStatus.completed) {
        await accrueContractReferralRewardForDeal(tx, deal.id);
      }

      return tx.deal.findUnique({
        where: { id: deal.id },
        include: {
          contract: {
            select: {
              id: true,
              slug: true,
              titleRu: true,
              titleEn: true,
            },
          },
          customer: {
            select: {
              id: true,
              name: true,
              telegramId: true,
              telegramUsername: true,
            },
          },
          freelancer: {
            select: {
              id: true,
              name: true,
              telegramId: true,
              telegramUsername: true,
            },
          },
          communication: {
            include: {
              messages: {
                orderBy: {
                  sentAt: "asc",
                },
              },
            },
          },
          reviews: {
            include: {
              reviewer: {
                select: reviewUserSelect,
              },
              reviewedUser: {
                select: reviewUserSelect,
              },
            },
          },
        },
      });
    });

    if (updatedDeal) {
      if (updatedDeal.contract) {
        revalidateContractPage(updatedDeal.contract.slug);
      }

      await notifyDealReviewSaved({
        deal: {
          id: updatedDeal.id,
          status: updatedDeal.status,
          contract: updatedDeal.contract
            ? {
                id: updatedDeal.contract.id,
                slug: updatedDeal.contract.slug,
                titleRu: updatedDeal.contract.titleRu,
                titleEn: updatedDeal.contract.titleEn,
              }
            : null,
          contractSnapshot: updatedDeal.contractSnapshot,
          customer: {
            id: updatedDeal.customer.id,
            name: updatedDeal.customer.name,
            telegramId: updatedDeal.customer.telegramId.toString(),
            telegramUsername: updatedDeal.customer.telegramUsername,
          },
          freelancer: {
            id: updatedDeal.freelancer.id,
            name: updatedDeal.freelancer.name,
            telegramId: updatedDeal.freelancer.telegramId.toString(),
            telegramUsername: updatedDeal.freelancer.telegramUsername,
          },
        },
        actorUserId: user.id,
        becameCompleted: !wasCompletedBeforeReview && updatedDeal.status === DealStatus.completed,
      });
    }

    return ok(
      updatedDeal
        ? {
            ...updatedDeal,
            reviews: updatedDeal.reviews.map(toPublicReview),
          }
        : null,
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
