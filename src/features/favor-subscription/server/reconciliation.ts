import {
  PaymentAsset,
  PaymentIntentStatus,
  PaymentProduct,
  PaymentProvider,
  Prisma,
} from "@prisma/client";

import { prisma } from "@/shared/lib/prisma";
import {
  findFavorSubscriptionTransactionByReference,
  findTonSubscriptionTransactionByReference,
} from "@/shared/lib/ton/server";

import { fulfillSubscriptionPayment } from "./fulfillment";

const RECONCILIATION_START_DELAY_MS = 30 * 1000;
const ONCHAIN_RECONCILIATION_GRACE_MS = 30 * 60 * 1000;
const RECONCILIATION_BACKOFF_MS = 60 * 1000;
const RECONCILIATION_LEASE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_RECONCILIATION_SWEEP_LIMIT = 5;
const MAX_RECONCILIATION_SWEEP_LIMIT = 20;

const activeOnchainSubscriptionWhere: Prisma.PaymentIntentWhereInput = {
  product: PaymentProduct.subscription,
  provider: PaymentProvider.ton_chain,
  asset: { in: [PaymentAsset.GRAM, PaymentAsset.FAVOR] },
  status: {
    in: [PaymentIntentStatus.created, PaymentIntentStatus.submitted],
  },
};

const toPendingResult = ({
  intent,
  serverTime,
}: {
  intent: {
    id: string;
    beneficiaryUserId: number | null;
    status: PaymentIntentStatus;
  };
  serverTime: Date;
}) => {
  if (!intent.beneficiaryUserId) {
    throw new Error("INVALID_SUBSCRIPTION_BENEFICIARY");
  }

  return {
    paymentIntentId: intent.id,
    recipientUserId: intent.beneficiaryUserId,
    activated: false as const,
    status: intent.status,
    terminal:
      intent.status === PaymentIntentStatus.failed ||
      intent.status === PaymentIntentStatus.expired,
    serverTime,
  };
};

const resolveAuthoritativeIntentResult = async ({
  intentId,
  payerUserId,
  serverTime,
}: {
  intentId: string;
  payerUserId: number;
  serverTime: Date;
}) => {
  const current = await prisma.paymentIntent.findFirst({
    where: {
      id: intentId,
      userId: payerUserId,
      product: PaymentProduct.subscription,
      provider: PaymentProvider.ton_chain,
      asset: { in: [PaymentAsset.GRAM, PaymentAsset.FAVOR] },
    },
    select: {
      id: true,
      beneficiaryUserId: true,
      status: true,
    },
  });
  if (!current) throw new Error("NOT_FOUND");

  if (current.status === PaymentIntentStatus.confirmed) {
    const fulfilled = await fulfillSubscriptionPayment({
      intentId,
      payerUserId,
      verification: null,
    });

    return {
      ...fulfilled,
      status: PaymentIntentStatus.confirmed,
      terminal: true,
      serverTime,
    };
  }

  return toPendingResult({ intent: current, serverTime });
};

const expireIntentAndResolve = async ({
  intentId,
  payerUserId,
  failureReason,
  serverTime,
}: {
  intentId: string;
  payerUserId: number;
  failureReason: string;
  serverTime: Date;
}) => {
  await prisma.paymentIntent.updateMany({
    where: {
      id: intentId,
      userId: payerUserId,
      ...activeOnchainSubscriptionWhere,
    },
    data: {
      status: PaymentIntentStatus.expired,
      failureReason,
    },
  });

  // A direct BOC confirmation may have raced the expiration update. Always
  // report the committed state instead of returning a synthetic terminal value.
  return resolveAuthoritativeIntentResult({ intentId, payerUserId, serverTime });
};

const claimReconciliationLease = async ({
  intentId,
  payerUserId,
  serverTime,
}: {
  intentId: string;
  payerUserId: number;
  serverTime: Date;
}) => {
  const staleBefore = new Date(
    serverTime.getTime() - RECONCILIATION_LEASE_TTL_MS,
  );
  const nextAttemptAt = new Date(
    serverTime.getTime() + RECONCILIATION_BACKOFF_MS,
  );
  const claimed = await prisma.paymentIntent.updateMany({
    where: {
      id: intentId,
      userId: payerUserId,
      ...activeOnchainSubscriptionWhere,
      AND: [
        {
          OR: [
            { reconciliationNextAttemptAt: null },
            { reconciliationNextAttemptAt: { lte: serverTime } },
          ],
        },
        {
          OR: [
            { reconciliationClaimedAt: null },
            { reconciliationClaimedAt: { lte: staleBefore } },
          ],
        },
      ],
    },
    data: {
      reconciliationClaimedAt: serverTime,
      reconciliationNextAttemptAt: nextAttemptAt,
    },
  });

  return claimed.count === 1;
};

const releaseReconciliationLease = (intentId: string, claimedAt: Date) =>
  prisma.paymentIntent.updateMany({
    where: { id: intentId, reconciliationClaimedAt: claimedAt },
    data: { reconciliationClaimedAt: null },
  });

export async function reconcileOnchainSubscriptionPayment({
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
      provider: PaymentProvider.ton_chain,
      asset: { in: [PaymentAsset.GRAM, PaymentAsset.FAVOR] },
    },
  });
  if (!intent) throw new Error("NOT_FOUND");

  const serverTime = new Date();
  if (
    intent.status === PaymentIntentStatus.confirmed ||
    intent.status === PaymentIntentStatus.failed ||
    intent.status === PaymentIntentStatus.expired
  ) {
    return resolveAuthoritativeIntentResult({ intentId, payerUserId, serverTime });
  }
  if (
    serverTime.getTime() - intent.createdAt.getTime() <
    RECONCILIATION_START_DELAY_MS
  ) {
    return toPendingResult({ intent, serverTime });
  }

  const leaseClaimed = await claimReconciliationLease({
    intentId,
    payerUserId,
    serverTime,
  });
  if (!leaseClaimed) {
    return resolveAuthoritativeIntentResult({ intentId, payerUserId, serverTime });
  }

  try {
    if (!intent.senderAddress || !intent.recipientAddress) {
      throw new Error("INVALID_ONCHAIN_SUBSCRIPTION_INTENT");
    }
    if (
      intent.asset === PaymentAsset.FAVOR &&
      (!intent.senderJettonWalletAddress ||
        !intent.recipientJettonWalletAddress)
    ) {
      throw new Error("INVALID_FAVOR_SUBSCRIPTION_INTENT");
    }

    const earliestTimestamp =
      Math.floor(intent.createdAt.getTime() / 1000) - 60;
    const lookup = intent.asset === PaymentAsset.GRAM
      ? await findTonSubscriptionTransactionByReference({
          reference: intent.reference,
          userId: payerUserId,
          expectedAmountNano: BigInt(intent.amountNano.toFixed(0)),
          senderAddress: intent.senderAddress,
          recipientAddress: intent.recipientAddress,
          earliestTimestamp,
        })
      : await findFavorSubscriptionTransactionByReference({
          reference: intent.reference,
          expectedFavorAmountNano: BigInt(intent.amountNano.toFixed(0)),
          senderAddress: intent.senderAddress,
          senderJettonWalletAddress: intent.senderJettonWalletAddress!,
          recipientJettonWalletAddress: intent.recipientJettonWalletAddress!,
          earliestTimestamp,
        });

    if (lookup.status === "budget_exhausted") {
      return resolveAuthoritativeIntentResult({
        intentId,
        payerUserId,
        serverTime,
      });
    }

    if (lookup.status === "found") {
      const paidAt = new Date(lookup.timestamp * 1000);
      if (
        !Number.isFinite(lookup.timestamp) ||
        Number.isNaN(paidAt.getTime()) ||
        paidAt > intent.expiresAt
      ) {
        return expireIntentAndResolve({
          intentId,
          payerUserId,
          failureReason: "PAYMENT_WINDOW_EXPIRED",
          serverTime,
        });
      }

      const fulfilled = await fulfillSubscriptionPayment({
        intentId,
        payerUserId,
        verification: lookup,
      });

      return {
        ...fulfilled,
        status: PaymentIntentStatus.confirmed,
        terminal: true,
        serverTime,
      };
    }

    if (
      serverTime.getTime() <
      intent.expiresAt.getTime() + ONCHAIN_RECONCILIATION_GRACE_MS
    ) {
      return resolveAuthoritativeIntentResult({
        intentId,
        payerUserId,
        serverTime,
      });
    }

    return expireIntentAndResolve({
      intentId,
      payerUserId,
      failureReason: "PAYMENT_RECONCILIATION_EXPIRED",
      serverTime,
    });
  } finally {
    await releaseReconciliationLease(intentId, serverTime);
  }
}

export async function reconcileDueOnchainSubscriptionPayments(
  limit = DEFAULT_RECONCILIATION_SWEEP_LIMIT,
) {
  const serverTime = new Date();
  const staleBefore = new Date(
    serverTime.getTime() - RECONCILIATION_LEASE_TTL_MS,
  );
  const scanBefore = new Date(
    serverTime.getTime() - RECONCILIATION_START_DELAY_MS,
  );
  const boundedLimit = Math.max(
    1,
    Math.min(Math.trunc(limit), MAX_RECONCILIATION_SWEEP_LIMIT),
  );
  const dueIntents = await prisma.paymentIntent.findMany({
    where: {
      ...activeOnchainSubscriptionWhere,
      createdAt: { lte: scanBefore },
      AND: [
        {
          OR: [
            { reconciliationNextAttemptAt: null },
            { reconciliationNextAttemptAt: { lte: serverTime } },
          ],
        },
        {
          OR: [
            { reconciliationClaimedAt: null },
            { reconciliationClaimedAt: { lte: staleBefore } },
          ],
        },
      ],
    },
    orderBy: [{ reconciliationNextAttemptAt: "asc" }, { createdAt: "asc" }],
    select: { id: true, userId: true },
    take: boundedLimit,
  });
  const results = await Promise.allSettled(
    dueIntents.map(({ id, userId }) =>
      reconcileOnchainSubscriptionPayment({
        intentId: id,
        payerUserId: userId,
      }),
    ),
  );

  return {
    attempted: dueIntents.length,
    activated: results.filter(
      (result) => result.status === "fulfilled" && result.value.activated,
    ).length,
    expired: results.filter(
      (result) =>
        result.status === "fulfilled" &&
        result.value.status === PaymentIntentStatus.expired,
    ).length,
    pending: results.filter(
      (result) =>
        result.status === "fulfilled" && !result.value.terminal,
    ).length,
    failed: results.filter((result) => result.status === "rejected").length,
  };
}
