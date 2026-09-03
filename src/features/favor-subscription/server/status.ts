import {
  PaymentAsset,
  PaymentIntentStatus,
  PaymentProduct,
  PaymentProvider,
} from "@prisma/client";

import { prisma } from "@/shared/lib/prisma";

import { parseSubscriptionIntentMetadata } from "./contracts";

const STARS_SUBMISSION_RECOVERY_GRACE_MS = 24 * 60 * 60 * 1000;

export async function getSubscriptionIntentStatus({
  intentId,
  payerUserId,
}: {
  intentId: string;
  payerUserId: number;
}) {
  const intent = await prisma.paymentIntent.findFirst({
    where: {
      id: intentId,
      userId: payerUserId,
      product: PaymentProduct.subscription,
    },
    select: {
      id: true,
      userId: true,
      beneficiaryUserId: true,
      provider: true,
      asset: true,
      status: true,
      txHash: true,
      confirmedAt: true,
      expiresAt: true,
      metadata: true,
      subscriptionPurchase: {
        select: { startsAt: true, endsAt: true },
      },
    },
  });

  if (!intent) throw new Error("NOT_FOUND");
  if (!intent.beneficiaryUserId) {
    throw new Error("INVALID_SUBSCRIPTION_BENEFICIARY");
  }

  const { duration } = parseSubscriptionIntentMetadata(intent.metadata);
  const now = new Date();
  const unclaimedInvoiceExpired =
    intent.provider === PaymentProvider.telegram_stars &&
    intent.status === PaymentIntentStatus.created && intent.expiresAt <= now;
  const submittedInvoiceRecoveryExpired =
    intent.provider === PaymentProvider.telegram_stars &&
    intent.status === PaymentIntentStatus.submitted &&
    intent.expiresAt.getTime() + STARS_SUBMISSION_RECOVERY_GRACE_MS <=
      now.getTime();
  const effectiveStatus =
    unclaimedInvoiceExpired || submittedInvoiceRecoveryExpired
      ? PaymentIntentStatus.expired
      : intent.status;

  return {
    paymentIntentId: intent.id,
    status: effectiveStatus,
    activated: effectiveStatus === PaymentIntentStatus.confirmed,
    terminal:
      effectiveStatus === PaymentIntentStatus.confirmed ||
      effectiveStatus === PaymentIntentStatus.failed ||
      effectiveStatus === PaymentIntentStatus.expired,
    recipientUserId: intent.beneficiaryUserId,
    isGift: intent.userId !== intent.beneficiaryUserId,
    duration,
    provider: intent.provider,
    asset: intent.asset,
    startsAt: intent.subscriptionPurchase?.startsAt ?? null,
    premiumExpiresAt: intent.subscriptionPurchase?.endsAt ?? null,
    transactionHash: intent.txHash,
    confirmedAt: intent.confirmedAt,
    expiresAt: intent.expiresAt,
    serverTime: now,
  };
}

export async function cancelSubscriptionIntent({
  intentId,
  payerUserId,
}: {
  intentId: string;
  payerUserId: number;
}) {
  const canceled = await prisma.paymentIntent.updateMany({
    where: {
      id: intentId,
      userId: payerUserId,
      product: PaymentProduct.subscription,
      provider: PaymentProvider.telegram_stars,
      asset: PaymentAsset.XTR,
      status: PaymentIntentStatus.created,
      providerSubmissionId: null,
    },
    data: {
      status: PaymentIntentStatus.failed,
      failureReason: "PAYER_CANCELLED",
    },
  });

  if (canceled.count === 1) {
    return {
      canceled: true,
      status: PaymentIntentStatus.failed,
    };
  }

  const intent = await prisma.paymentIntent.findFirst({
    where: {
      id: intentId,
      userId: payerUserId,
      product: PaymentProduct.subscription,
    },
    select: { status: true },
  });
  if (!intent) throw new Error("NOT_FOUND");

  return {
    canceled:
      intent.status === PaymentIntentStatus.failed ||
      intent.status === PaymentIntentStatus.expired,
    status: intent.status,
  };
}
