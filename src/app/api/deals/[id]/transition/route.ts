import { ContractStatus, DealStatus } from "@prisma/client";
import { z } from "zod";

import { revalidateContractPage } from "@/entities/contract/server";
import {
  canTransitionDeal,
  getDealTransitionPolicyViolation,
  getDealExecutionTiming,
  OPEN_DEAL_STATUSES,
} from "@/entities/deal";
import {
  accrueContractReferralRewardForDeal,
  cancelContractReferralRewardForDeal,
} from "@/features/contract-referrals/server";
import { notifyDealStatusChanged } from "@/features/deal-notifications";
import { notifyContractStatusChanged } from "@/features/contract-notifications";
import { handleRouteError, ok } from "@/shared/lib/api";
import { requireUser } from "@/shared/lib/auth";
import { prisma } from "@/shared/lib/prisma";
import {
  getEscrowReleaseProof,
} from "@/shared/lib/ton/escrow-status.server";

const schema = z.object({
  toStatus: z.nativeEnum(DealStatus),
});

const freelancerOnlyTransitions = new Set<DealStatus>([
  DealStatus.work_completed_by_freelancer,
  DealStatus.payment_received_by_freelancer,
  DealStatus.result_sent_by_freelancer,
]);

const customerOnlyTransitions = new Set<DealStatus>([
  DealStatus.paid_by_customer,
  DealStatus.result_received_by_customer,
  DealStatus.revision_requested,
  DealStatus.awaiting_review,
  DealStatus.completed,
]);

const referralAccrualStatuses = new Set<DealStatus>([
  DealStatus.paid_by_customer,
  DealStatus.awaiting_review,
  DealStatus.completed,
]);

const referralCancellationStatuses = new Set<DealStatus>([
  DealStatus.rejected,
  DealStatus.cancelled,
]);

const escrowRefundSyncStatuses = new Set<DealStatus>([
  DealStatus.in_progress,
  DealStatus.work_completed_by_freelancer,
]);

type Params = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const { toStatus } = schema.parse(await request.json());

    const deal = await prisma.deal.findUnique({
      where: {
        id: Number(id),
      },
      include: {
        contract: {
          select: {
            id: true,
            maxOpenDeals: true,
            status: true,
          },
        },
      },
    });

    if (!deal) {
      throw new Error("DEAL_NOT_FOUND");
    }

    const isCustomer = deal.customerId === user.id;
    const isFreelancer = deal.freelancerId === user.id;
    const transitionedAt = new Date();
    const isEscrowRelease =
      deal.isEscrow && toStatus === DealStatus.awaiting_review;
    const isEscrowRefund =
      deal.isEscrow &&
      escrowRefundSyncStatuses.has(deal.status) &&
      toStatus === DealStatus.cancelled;

    if (!isCustomer && !isFreelancer) {
      throw new Error("FORBIDDEN");
    }

    const transitionPolicyViolation = getDealTransitionPolicyViolation({
      fromStatus: deal.status,
      toStatus,
      isEscrow: deal.isEscrow,
      isFreelancer,
      plannedDeadlineAt: deal.plannedDeadlineAt,
      now: transitionedAt.getTime(),
    });
    if (transitionPolicyViolation === "payment_flow_mismatch") {
      throw new Error("DEAL_TRANSITION_INVALID");
    }
    if (transitionPolicyViolation === "escrow_deadline_expired") {
      throw new Error("DEAL_DEADLINE_EXPIRED");
    }

    if (!canTransitionDeal(deal.status, toStatus) && !isEscrowRefund) {
      throw new Error("DEAL_TRANSITION_INVALID");
    }

    if (toStatus === DealStatus.completed) {
      throw new Error("DEAL_COMPLETES_AFTER_BOTH_REVIEWS");
    }

    if (freelancerOnlyTransitions.has(toStatus) && !isFreelancer) {
      throw new Error("DEAL_ACTION_FREELANCER_ONLY");
    }

    if (customerOnlyTransitions.has(toStatus) && !isCustomer) {
      throw new Error("DEAL_ACTION_CUSTOMER_ONLY");
    }

    if (isEscrowRelease) {
      if (!deal.escrowAddress) {
        throw new Error("Escrow contract is not prepared.");
      }

      const releaseProof = await getEscrowReleaseProof(deal.escrowAddress);
      if (!releaseProof.released) {
        throw new Error("Escrow payout is not confirmed on-chain yet.");
      }
    }

    if (isEscrowRefund) {
      if (!deal.escrowAddress) {
        throw new Error("Escrow contract is not prepared.");
      }

      const refundProof = await getEscrowReleaseProof(deal.escrowAddress);
      if (!refundProof.refunded) {
        throw new Error("Escrow refund is not confirmed on-chain yet.");
      }
    }

    if (
      (toStatus === DealStatus.in_progress || toStatus === DealStatus.rejected) &&
      !isFreelancer &&
      !isCustomer
    ) {
      throw new Error("FORBIDDEN");
    }

    const previousStatus = deal.status;
    const executionTiming = getDealExecutionTiming({
      deadlineDays: deal.deadlineDays,
      activatedAt: transitionedAt,
      plannedStartedAt: deal.plannedStartedAt,
      plannedDeadlineAt: deal.plannedDeadlineAt,
    });

    const updatedDeal = await prisma.$transaction(async (tx) => {
      const transition = await tx.deal.updateMany({
        where: {
          id: deal.id,
          status: isEscrowRefund
            ? { in: Array.from(escrowRefundSyncStatuses) }
            : previousStatus,
        },
        data: {
          status: toStatus,
          paymentExpiresAt: toStatus === DealStatus.in_progress ? null : undefined,
          plannedStartedAt:
            toStatus === DealStatus.in_progress
              ? executionTiming.startedAt
              : undefined,
          plannedDeadlineAt:
            toStatus === DealStatus.in_progress
              ? executionTiming.deadlineAt
              : undefined,
          escrowState: isEscrowRelease
            ? "released"
            : isEscrowRefund
              ? "refunded"
              : undefined,
          paidByCustomer:
            toStatus === DealStatus.paid_by_customer || isEscrowRelease
              ? true
              : undefined,
          paymentReceivedByFreelancer:
            toStatus === DealStatus.payment_received_by_freelancer || isEscrowRelease
              ? true
              : undefined,
          resultSentByFreelancer:
            toStatus === DealStatus.result_sent_by_freelancer ? true : undefined,
          resultReceivedByCustomer:
            toStatus === DealStatus.result_received_by_customer ? true : undefined,
        },
      });
      if (transition.count !== 1) {
        throw new Error("DEAL_TRANSITION_CONFLICT");
      }

      const nextDeal = await tx.deal.findUniqueOrThrow({
        where: { id: deal.id },
      });

      let updatedContract = null;
      if (deal.contractId !== null && deal.contract) {
        const openDealsCount = await tx.deal.count({
          where: {
            contractId: deal.contractId,
            status: {
              in: OPEN_DEAL_STATUSES,
            },
          },
        });

        if (
          deal.contract.status === ContractStatus.limit_reached &&
          (deal.contract.maxOpenDeals === null || openDealsCount < deal.contract.maxOpenDeals)
        ) {
          updatedContract = await tx.contract.update({
            where: {
              id: deal.contractId,
            },
            data: {
              status: ContractStatus.active,
            },
            include: {
              author: { select: { id: true, telegramId: true } },
              scout: { select: { id: true, telegramId: true } },
            },
          });
        }
      }

      if (referralAccrualStatuses.has(toStatus)) {
        await accrueContractReferralRewardForDeal(tx, deal.id);
      }

      if (referralCancellationStatuses.has(toStatus)) {
        await cancelContractReferralRewardForDeal(tx, deal.id);
      }

      return { nextDeal, updatedContract };
    });

    if (updatedDeal.updatedContract) {
      await notifyContractStatusChanged({
        contract: updatedDeal.updatedContract,
        previousStatus: ContractStatus.limit_reached,
      });
      revalidateContractPage(updatedDeal.updatedContract.slug);
    }

    const dealForNotifications = await prisma.deal.findUnique({
      where: {
        id: deal.id,
      },
      select: {
        id: true,
        status: true,
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
      },
    });

    if (dealForNotifications) {
      await notifyDealStatusChanged({
        deal: dealForNotifications,
        actorUserId: user.id,
        previousStatus,
      });
    }

    return ok(updatedDeal.nextDeal);
  } catch (error) {
    return handleRouteError(error);
  }
}
