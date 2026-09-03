import { DealStatus, type Deal, type Prisma } from "@prisma/client";

import { getDealExecutionTiming } from "@/entities/deal";

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

type FundedDealTimingInput = Pick<
  Deal,
  "deadlineDays" | "plannedStartedAt" | "plannedDeadlineAt"
>;

export const getFundedDealExecutionTiming = ({
  deal,
  activatedAt,
  onChainDeadlineAt,
}: {
  deal: FundedDealTimingInput;
  activatedAt: Date;
  onChainDeadlineAt?: Date | null;
}) => {
  if (
    !deal.plannedStartedAt &&
    !deal.plannedDeadlineAt &&
    deal.deadlineDays &&
    onChainDeadlineAt
  ) {
    return {
      startedAt: new Date(
        onChainDeadlineAt.getTime() -
          deal.deadlineDays * DAY_IN_MILLISECONDS,
      ),
      deadlineAt: onChainDeadlineAt,
    };
  }

  return getDealExecutionTiming({
    deadlineDays: deal.deadlineDays,
    activatedAt,
    plannedStartedAt: deal.plannedStartedAt,
    plannedDeadlineAt: deal.plannedDeadlineAt,
  });
};

export type ActivateFundedDealTransactionRunner = <Result>(
  operation: (tx: Prisma.TransactionClient) => Promise<Result>,
) => Promise<Result>;

export async function activateFundedDealWithDependencies({
  dealId,
  txHash,
  onChainDeadlineAt,
  activatedAt,
  runTransaction,
}: {
  dealId: number;
  txHash?: string;
  onChainDeadlineAt?: Date | null;
  activatedAt: Date;
  runTransaction: ActivateFundedDealTransactionRunner;
}) {
  return runTransaction(async (tx) => {
    const currentDeal = await tx.deal.findUnique({
      where: { id: dealId },
    });

    if (!currentDeal) {
      throw new Error("DEAL_NOT_FOUND");
    }

    if (currentDeal.status === DealStatus.in_progress) {
      return { deal: currentDeal, activated: false };
    }

    if (currentDeal.status !== DealStatus.pending_approval) {
      throw new Error("DEAL_ESCROW_ACTIVATION_INVALID");
    }

    const timing = getFundedDealExecutionTiming({
      deal: currentDeal,
      activatedAt,
      onChainDeadlineAt,
    });
    const activation = await tx.deal.updateMany({
      where: {
        id: dealId,
        status: DealStatus.pending_approval,
      },
      data: {
        status: DealStatus.in_progress,
        escrowState: "locked",
        escrowTxHash: txHash || undefined,
        paidByCustomer: true,
        paymentExpiresAt: null,
        plannedStartedAt: timing.startedAt,
        plannedDeadlineAt: timing.deadlineAt,
        escrowFundingCheckedAt: activatedAt,
        paymentReminderNotifiedAt: null,
        paymentReminderAttemptedAt: null,
        deadlineReminderNotifiedAt: null,
        deadlineReminderAttemptedAt: null,
        deadlineExpiredAt: null,
        deadlineCustomerNotifiedAt: null,
        deadlineFreelancerNotifiedAt: null,
        deadlineOverdueAttemptedAt: null,
      },
    });

    const deal = await tx.deal.findUnique({ where: { id: dealId } });
    if (!deal) {
      throw new Error("DEAL_NOT_FOUND");
    }

    return { deal, activated: activation.count === 1 };
  });
}
