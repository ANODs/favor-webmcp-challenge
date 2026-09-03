import { normalizeDealBriefResources } from "@/entities/deal";
import { handleRouteError, ok } from "@/shared/lib/api";
import { requireUser } from "@/shared/lib/auth";
import { prisma } from "@/shared/lib/prisma";
import { reviewUserSelect, toPublicReview } from "@/shared/lib/review";

export async function GET() {
  try {
    const user = await requireUser();

    const deals = await prisma.deal.findMany({
      where: user.role === "moderator" ? {} : {
        OR: [{ customerId: user.id }, { freelancerId: user.id }],
      },
      orderBy: {
        updatedAt: "desc",
      },
      include: {
        contract: {
          select: {
            id: true,
            titleRu: true,
            titleEn: true,
            slug: true,
            type: true,
            status: true,
            mediaRefs: true,
            basePrice: true,
            deadlineDays: true,
          },
        },
        customer: {
          select: {
            id: true,
            name: true,
            telegramId: true,
            telegramUsername: true,
            walletAddress: true,
          },
        },
        freelancer: {
          select: {
            id: true,
            name: true,
            telegramId: true,
            telegramUsername: true,
            walletAddress: true,
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

    return ok(
      deals.map((deal) => ({
        ...deal,
        briefResources: normalizeDealBriefResources(deal.briefResources),
        reviews: deal.reviews.map(toPublicReview),
        reviewLeftByCustomer: deal.reviews.some(
          (review) => review.reviewerId === deal.customerId,
        ),
        reviewLeftByFreelancer: deal.reviews.some(
          (review) => review.reviewerId === deal.freelancerId,
        ),
      })),
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
