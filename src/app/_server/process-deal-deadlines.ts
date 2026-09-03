import { DealStatus, Prisma, type PrismaClient } from "@prisma/client";

import { activateFundedDealWithDependencies } from "@/features/deal-escrow/server";
import {
  notifyDealDeadlineApproaching,
  notifyDealOverdue,
  notifyDealPaymentExpired,
  notifyDealPaymentExpiring,
  notifyDealStatusChanged,
} from "@/features/deal-notifications/server";
import {
  ESCROW_STATUS_ACTIVE,
  getEscrowContractDeadlineAt,
  getEscrowContractJettonWallet,
  getEscrowContractStatus,
  getPreparedEscrowContractStatus,
} from "@/shared/lib/ton/escrow-status.server";
import { getJettonWalletBalance } from "@/shared/lib/ton/server";
import { isStablecoinEscrowCurrency } from "@/shared/lib/ton/stablecoin";
import { safeParseAddress } from "@/shared/lib/ton";

const PROCESS_LOCK_ID = 7_246_311;
const PROCESS_BATCH_SIZE = 25;
const HOUR_IN_MILLISECONDS = 60 * 60 * 1000;

const deadlineDealSelect = {
  id: true,
  status: true,
  isEscrow: true,
  escrowAddress: true,
  escrowVersion: true,
  escrowCurrency: true,
  escrowJettonWalletAddress: true,
  escrowJettonAmount: true,
  escrowFundingCheckedAt: true,
  paidByCustomer: true,
  paymentExpiresAt: true,
  plannedDeadlineAt: true,
  paymentReminderNotifiedAt: true,
  paymentReminderAttemptedAt: true,
  deadlineReminderNotifiedAt: true,
  deadlineReminderAttemptedAt: true,
  deadlineExpiredAt: true,
  deadlineCustomerNotifiedAt: true,
  deadlineFreelancerNotifiedAt: true,
  deadlineOverdueAttemptedAt: true,
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
} satisfies Prisma.DealSelect;

export type DealDeadlineProcessingResult = {
  skippedBecauseLocked: boolean;
  activatedFundedDeals: number;
  cancelledExpiredPayments: number;
  paymentRemindersSent: number;
  deadlineRemindersSent: number;
  overdueDealsMarked: number;
  overdueCustomerNotificationsSent: number;
  overdueFreelancerNotificationsSent: number;
};

const createEmptyResult = (): DealDeadlineProcessingResult => ({
  skippedBecauseLocked: false,
  activatedFundedDeals: 0,
  cancelledExpiredPayments: 0,
  paymentRemindersSent: 0,
  deadlineRemindersSent: 0,
  overdueDealsMarked: 0,
  overdueCustomerNotificationsSent: 0,
  overdueFreelancerNotificationsSent: 0,
});

const getHoursLeft = (deadline: Date, now: Date) =>
  Math.max(1, Math.ceil((deadline.getTime() - now.getTime()) / HOUR_IN_MILLISECONDS));

export async function processDealDeadlines({
  database,
  now = new Date(),
}: {
  database: PrismaClient;
  now?: Date;
}): Promise<DealDeadlineProcessingResult> {
  return database.$transaction(
    async (tx) => {
      const [lock] = await tx.$queryRaw<Array<{ acquired: boolean }>>(
        Prisma.sql`SELECT pg_try_advisory_xact_lock(${PROCESS_LOCK_ID}) AS acquired`,
      );
      const result = createEmptyResult();

      if (!lock?.acquired) {
        result.skippedBecauseLocked = true;
        return result;
      }

      const fundedDeals = await database.deal.findMany({
        where: {
          status: DealStatus.pending_approval,
          isEscrow: true,
          paidByCustomer: false,
          escrowAddress: { not: null },
        },
        orderBy: [
          {
            escrowFundingCheckedAt: { sort: "asc", nulls: "first" },
          },
          { id: "asc" },
        ],
        take: PROCESS_BATCH_SIZE,
        select: deadlineDealSelect,
      });

      for (const deal of fundedDeals) {
        try {
          const chainStatus = await getEscrowContractStatus(deal.escrowAddress!);
          if (chainStatus !== ESCROW_STATUS_ACTIVE) {
            continue;
          }

          if (isStablecoinEscrowCurrency(deal.escrowCurrency)) {
            if (
              !deal.escrowJettonWalletAddress ||
              !deal.escrowJettonAmount ||
              deal.escrowJettonAmount.lte(0)
            ) {
              continue;
            }

            const [walletBalance, configuredJettonWallet] = await Promise.all([
              getJettonWalletBalance(deal.escrowJettonWalletAddress),
              getEscrowContractJettonWallet(deal.escrowAddress!),
            ]);
            if (
              walletBalance < BigInt(deal.escrowJettonAmount.toString()) ||
              !configuredJettonWallet.equals(
                safeParseAddress(deal.escrowJettonWalletAddress),
              )
            ) {
              continue;
            }
          }

          const onChainDeadlineAt =
            deal.escrowVersion >= 2
              ? await getEscrowContractDeadlineAt(deal.escrowAddress!)
              : null;
          if (deal.escrowVersion >= 2 && !onChainDeadlineAt) {
            continue;
          }

          const activation = await activateFundedDealWithDependencies({
            dealId: deal.id,
            activatedAt: now,
            onChainDeadlineAt,
            runTransaction: (operation) => database.$transaction(operation),
          });
          if (!activation.activated) {
            continue;
          }

          result.activatedFundedDeals += 1;
          const activatedDeal = await database.deal.findUnique({
            where: { id: deal.id },
            select: deadlineDealSelect,
          });
          if (activatedDeal) {
            await notifyDealStatusChanged({
              deal: activatedDeal,
              actorUserId: activatedDeal.customer.id,
              previousStatus: DealStatus.pending_approval,
            });
          }
        } catch (error) {
          console.warn(`[deal-deadlines] unable to reconcile escrow #${deal.id}`, error);
        } finally {
          await database.deal.updateMany({
            where: {
              id: deal.id,
              status: DealStatus.pending_approval,
            },
            data: { escrowFundingCheckedAt: now },
          });
        }
      }

      const expiredPaymentDeals = await database.deal.findMany({
        where: {
          paymentExpiresAt: { lt: now },
          status: DealStatus.pending_approval,
          paidByCustomer: false,
        },
        orderBy: [
          {
            escrowFundingCheckedAt: { sort: "asc", nulls: "first" },
          },
          { paymentExpiresAt: "asc" },
        ],
        take: PROCESS_BATCH_SIZE,
        select: deadlineDealSelect,
      });

      for (const deal of expiredPaymentDeals) {
        let canCancelForPaymentExpiry = true;

        if (deal.isEscrow && deal.escrowAddress) {
          try {
            const chainStatus = await getPreparedEscrowContractStatus(
              deal.escrowAddress,
            );
            if (chainStatus !== null && chainStatus > 0n) {
              canCancelForPaymentExpiry = false;
            }
          } catch (error) {
            console.warn(
              `[deal-deadlines] skipped payment expiry for escrow #${deal.id}: on-chain status unavailable`,
              error,
            );
            canCancelForPaymentExpiry = false;
          } finally {
            await database.deal.updateMany({
              where: {
                id: deal.id,
                status: DealStatus.pending_approval,
              },
              data: { escrowFundingCheckedAt: now },
            });
          }
        }

        if (!canCancelForPaymentExpiry) {
          continue;
        }

        const cancellation = await database.deal.updateMany({
          where: {
            id: deal.id,
            status: DealStatus.pending_approval,
            paidByCustomer: false,
          },
          data: { status: DealStatus.cancelled },
        });
        if (cancellation.count !== 1) {
          continue;
        }

        result.cancelledExpiredPayments += 1;
        await notifyDealPaymentExpired({ deal });
      }

      const paymentReminderDeadline = new Date(now.getTime() + 2 * HOUR_IN_MILLISECONDS);
      const expiringPaymentDeals = await database.deal.findMany({
        where: {
          paymentExpiresAt: { gte: now, lte: paymentReminderDeadline },
          status: DealStatus.pending_approval,
          paidByCustomer: false,
          paymentReminderNotifiedAt: null,
        },
        orderBy: [
          {
            paymentReminderAttemptedAt: { sort: "asc", nulls: "first" },
          },
          { paymentExpiresAt: "asc" },
        ],
        take: PROCESS_BATCH_SIZE,
        select: deadlineDealSelect,
      });

      for (const deal of expiringPaymentDeals) {
        if (!deal.paymentExpiresAt) {
          continue;
        }

        const sent = await notifyDealPaymentExpiring({
          deal,
          hoursLeft: getHoursLeft(deal.paymentExpiresAt, now),
        });
        await database.deal.update({
          where: { id: deal.id },
          data: {
            paymentReminderAttemptedAt: now,
            paymentReminderNotifiedAt: sent ? now : undefined,
          },
        });
        if (sent) {
          result.paymentRemindersSent += 1;
        }
      }

      const approachingDeadline = new Date(now.getTime() + 24 * HOUR_IN_MILLISECONDS);
      const approachingDeals = await database.deal.findMany({
        where: {
          status: DealStatus.in_progress,
          plannedDeadlineAt: { gt: now, lte: approachingDeadline },
          deadlineReminderNotifiedAt: null,
        },
        orderBy: [
          {
            deadlineReminderAttemptedAt: { sort: "asc", nulls: "first" },
          },
          { plannedDeadlineAt: "asc" },
        ],
        take: PROCESS_BATCH_SIZE,
        select: deadlineDealSelect,
      });

      for (const deal of approachingDeals) {
        if (!deal.plannedDeadlineAt) {
          continue;
        }

        const sent = await notifyDealDeadlineApproaching({
          deal,
          hoursLeft: getHoursLeft(deal.plannedDeadlineAt, now),
        });
        await database.deal.update({
          where: { id: deal.id },
          data: {
            deadlineReminderAttemptedAt: now,
            deadlineReminderNotifiedAt: sent ? now : undefined,
          },
        });
        if (sent) {
          result.deadlineRemindersSent += 1;
        }
      }

      const overdueDeals = await database.deal.findMany({
        where: {
          status: DealStatus.in_progress,
          plannedDeadlineAt: { lte: now },
          OR: [
            { deadlineExpiredAt: null },
            { deadlineCustomerNotifiedAt: null },
            { deadlineFreelancerNotifiedAt: null },
          ],
        },
        orderBy: [
          {
            deadlineOverdueAttemptedAt: { sort: "asc", nulls: "first" },
          },
          { plannedDeadlineAt: "asc" },
        ],
        take: PROCESS_BATCH_SIZE,
        select: deadlineDealSelect,
      });

      for (const deal of overdueDeals) {
        if (!deal.deadlineExpiredAt) {
          result.overdueDealsMarked += 1;
        }

        const notification = await notifyDealOverdue({
          deal,
          notifyCustomer: !deal.deadlineCustomerNotifiedAt,
          notifyFreelancer: !deal.deadlineFreelancerNotifiedAt,
        });
        const notificationMarkers: Prisma.DealUpdateInput = {
          deadlineExpiredAt: deal.deadlineExpiredAt ? undefined : now,
          deadlineOverdueAttemptedAt: now,
        };

        if (notification.customerSent) {
          notificationMarkers.deadlineCustomerNotifiedAt = now;
          result.overdueCustomerNotificationsSent += 1;
        }
        if (notification.freelancerSent) {
          notificationMarkers.deadlineFreelancerNotifiedAt = now;
          result.overdueFreelancerNotificationsSent += 1;
        }
        await database.deal.update({
          where: { id: deal.id },
          data: notificationMarkers,
        });
      }

      return result;
    },
    { maxWait: 10_000, timeout: 600_000 },
  );
}
