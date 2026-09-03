import { PaymentIntentStatus, PaymentProduct, Prisma } from "@prisma/client";

import { resolveSubscriptionPeriod } from "@/entities/subscription";
import { prisma } from "@/shared/lib/prisma";

import { parseSubscriptionIntentMetadata } from "./contracts";
import { notifyConfirmedSubscriptionGift } from "./gift-notification";

type PaymentVerification = {
  transactionHash: string;
  timestamp: number;
};

type ConfirmedSubscriptionResult = ReturnType<typeof toConfirmedResult>;

const toConfirmedResult = ({
  intent,
  newlyConfirmed,
}: {
  intent: {
    userId: number;
    beneficiaryUserId: number | null;
    txHash: string | null;
    subscriptionPurchase: { endsAt: Date } | null;
  };
  newlyConfirmed: boolean;
}) => {
  if (!intent.beneficiaryUserId || !intent.subscriptionPurchase) {
    throw new Error("INVALID_CONFIRMED_SUBSCRIPTION_INTENT");
  }

  return {
    activated: true as const,
    newlyConfirmed,
    recipientUserId: intent.beneficiaryUserId,
    isGift: intent.userId !== intent.beneficiaryUserId,
    premiumExpiresAt: intent.subscriptionPurchase.endsAt,
    transactionHash: intent.txHash,
  };
};

const notifyGiftAfterCommit = async (
  intentId: string,
  result: ConfirmedSubscriptionResult,
) => {
  if (!result.newlyConfirmed || !result.isGift) return;

  try {
    await notifyConfirmedSubscriptionGift({
      intentId,
      newlyConfirmed: true,
    });
  } catch (error) {
    // Notification delivery must never turn a committed payment into a failed one.
    console.error("[favor-subscription] post-commit gift notification failed", {
      intentId,
      error,
    });
  }
};

export async function fulfillSubscriptionPayment({
  intentId,
  payerUserId,
  verification,
}: {
  intentId: string;
  payerUserId: number;
  verification: PaymentVerification | null;
}) {
  for (let transactionAttempt = 0; transactionAttempt < 3; transactionAttempt += 1) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const intent = await tx.paymentIntent.findFirst({
          where: {
            id: intentId,
            userId: payerUserId,
            product: PaymentProduct.subscription,
          },
          include: { subscriptionPurchase: { select: { endsAt: true } } },
        });

        if (!intent) throw new Error("NOT_FOUND");
        if (intent.status === PaymentIntentStatus.confirmed) {
          return toConfirmedResult({ intent, newlyConfirmed: false });
        }
        if (intent.status === PaymentIntentStatus.failed) {
          throw new Error("SUBSCRIPTION_PAYMENT_FAILED");
        }
        if (!verification) {
          if (intent.status === PaymentIntentStatus.expired) {
            throw new Error("PAYMENT_WINDOW_EXPIRED");
          }
          throw new Error("SUBSCRIPTION_PAYMENT_NOT_VERIFIED");
        }
        if (!intent.beneficiaryUserId) {
          throw new Error("INVALID_SUBSCRIPTION_BENEFICIARY");
        }

        const { duration } = parseSubscriptionIntentMetadata(intent.metadata);
        const paidAt = new Date(verification.timestamp * 1000);
        if (
          !Number.isFinite(verification.timestamp) ||
          Number.isNaN(paidAt.getTime()) ||
          paidAt > intent.expiresAt
        ) {
          throw new Error("PAYMENT_WINDOW_EXPIRED");
        }
        // An indexer may reveal a timely on-chain payment only after the intent
        // was marked expired. A verified paidAt inside the frozen payment window
        // is allowed to recover that intent atomically in this transaction.
        const beneficiary = await tx.user.findUniqueOrThrow({
          where: { id: intent.beneficiaryUserId },
          select: { premiumExpiresAt: true },
        });
        const { startsAt, endsAt } = resolveSubscriptionPeriod({
          paymentAt: paidAt,
          currentExpiresAt: beneficiary.premiumExpiresAt,
          duration,
        });

        const subscriptionPurchase = await tx.subscriptionPurchase.create({
          data: {
            paymentIntentId: intent.id,
            userId: intent.beneficiaryUserId,
            duration,
            startsAt,
            endsAt,
          },
          select: { endsAt: true },
        });
        await tx.user.update({
          where: { id: intent.beneficiaryUserId },
          data: { isPremium: true, premiumExpiresAt: endsAt },
        });
        const confirmedIntent = await tx.paymentIntent.update({
          where: { id: intent.id },
          data: {
            status: PaymentIntentStatus.confirmed,
            txHash: verification.transactionHash,
            txTimestamp: paidAt,
            confirmedAt: new Date(),
          },
          select: {
            userId: true,
            beneficiaryUserId: true,
            txHash: true,
          },
        });

        return toConfirmedResult({
          intent: { ...confirmedIntent, subscriptionPurchase },
          newlyConfirmed: true,
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

      await notifyGiftAfterCommit(intentId, result);
      return result;
    } catch (error) {
      const confirmed = await prisma.paymentIntent.findFirst({
        where: {
          id: intentId,
          userId: payerUserId,
          product: PaymentProduct.subscription,
          status: PaymentIntentStatus.confirmed,
        },
        select: {
          userId: true,
          beneficiaryUserId: true,
          txHash: true,
          subscriptionPurchase: { select: { endsAt: true } },
        },
      });

      if (confirmed) {
        return toConfirmedResult({ intent: confirmed, newlyConfirmed: false });
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034" &&
        transactionAttempt < 2
      ) {
        continue;
      }
      throw error;
    }
  }

  throw new Error("SUBSCRIPTION_CONFIRMATION_RETRY_EXHAUSTED");
}
