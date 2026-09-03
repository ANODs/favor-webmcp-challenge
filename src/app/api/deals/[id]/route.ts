import { z } from "zod";

import { normalizeDealBriefResources } from "@/entities/deal";
import { handleRouteError, ok } from "@/shared/lib/api";
import { requireUser } from "@/shared/lib/auth";
import { prisma } from "@/shared/lib/prisma";
import { reviewUserSelect, toPublicReview } from "@/shared/lib/review";


type Params = {
  params: Promise<{
    id: string;
  }>;
};

const contractReferralSelect = {
  id: true,
  source: true,
  rewardPercent: true,
  referrer: {
    select: {
      id: true,
      name: true,
      telegramUsername: true,
      walletAddress: true,
    },
  },
};

const serializeDeal = <
  T extends {
    reviews: Array<{
      reviewerId: number;
      reviewer: {
        telegramUsername: string | null;
        isTelegramUsernameHidden: boolean;
      };
      reviewedUser: {
        telegramUsername: string | null;
        isTelegramUsernameHidden: boolean;
      };
    }>;
    customerId: number;
    freelancerId: number;
    briefResources?: unknown;
    contract?: ({ referral?: unknown } & Record<string, unknown>) | null;
  },
>(deal: T) => {
  const contractReferral = deal.contract?.referral ?? null;
  const reviews = deal.reviews.map(toPublicReview);
  const briefResources = normalizeDealBriefResources(deal.briefResources);

  if (!deal.contract) {
    return {
      ...deal,
      briefResources,
      reviews,
      contractReferral,
      reviewLeftByCustomer: deal.reviews.some(
        (review) => review.reviewerId === deal.customerId,
      ),
      reviewLeftByFreelancer: deal.reviews.some(
        (review) => review.reviewerId === deal.freelancerId,
      ),
    };
  }

  const contract = { ...deal.contract };
  delete contract.referral;

  return {
    ...deal,
    briefResources,
    contract,
    reviews,
    contractReferral,
    reviewLeftByCustomer: deal.reviews.some(
      (review) => review.reviewerId === deal.customerId,
    ),
    reviewLeftByFreelancer: deal.reviews.some(
      (review) => review.reviewerId === deal.freelancerId,
    ),
  };
};

export async function GET(_request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const deal = await prisma.deal.findUnique({
      where: {
        id: Number(id),
      },
      include: {
        contract: {
          include: {
            referral: {
              select: contractReferralSelect,
            },
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

    if (!deal) {
      throw new Error("DEAL_NOT_FOUND");
    }

    if (deal.customerId !== user.id && deal.freelancerId !== user.id && user.role !== "moderator") {
      throw new Error("FORBIDDEN");
    }

    return ok(serializeDeal(deal));
  } catch (error) {
    return handleRouteError(error);
  }
}

const updateDealSchema = z.object({
  escrowState: z.string().nullable().optional(),
});

export async function PATCH(request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = updateDealSchema.parse(await request.json());

    const deal = await prisma.deal.findUnique({
      where: {
        id: Number(id),
      },
    });

    if (!deal) {
      throw new Error("DEAL_NOT_FOUND");
    }

    if (deal.customerId !== user.id && deal.freelancerId !== user.id && user.role !== "moderator") {
      throw new Error("FORBIDDEN");
    }

    const updatedDeal = await prisma.deal.update({
      where: {
        id: deal.id,
      },
      data: {
        ...(body.escrowState !== undefined ? { escrowState: body.escrowState } : {}),
      },
      include: {
        contract: {
          include: {
            referral: {
              select: contractReferralSelect,
            },
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

    return ok(serializeDeal(updatedDeal));
  } catch (error) {
    return handleRouteError(error);
  }
}
