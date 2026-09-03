import { PaymentAsset, PaymentIntentStatus, PaymentProduct, Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";

import { env } from "@/shared/config/env";
import { prisma } from "@/shared/lib/prisma";
import {
  getJettonWalletAddress,
  verifyFavorJettonSubscriptionTransaction,
} from "@/shared/lib/ton/server";

export const FAVOR_SINK_ADDRESS = "EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c";

type PrepareFavorPaymentInput = {
  userId: number;
  beneficiaryUserId?: number;
  idempotencyKey?: string;
  userWalletAddress: string;
  amountNano: bigint;
  quotedPriceUsdt: number;
  product: PaymentProduct;
  expiresAt: Date;
  metadata?: Prisma.InputJsonObject;
};

export async function prepareFavorPaymentIntent(input: PrepareFavorPaymentInput) {
  if (input.amountNano <= 0n || input.expiresAt <= new Date()) {
    throw new Error("INVALID_PAYMENT_QUOTE");
  }

  const [senderJettonWallet, recipientJettonWallet] = await Promise.all([
    getJettonWalletAddress({
      masterAddress: env.requireFavorJettonMasterAddress(),
      ownerAddress: input.userWalletAddress,
    }),
    getJettonWalletAddress({
      masterAddress: env.requireFavorJettonMasterAddress(),
      ownerAddress: FAVOR_SINK_ADDRESS,
    }),
  ]);
  const reference = `favor-payment:${input.product}:${input.userId}:${randomUUID()}`;

  return prisma.paymentIntent.create({
    data: {
      userId: input.userId,
      beneficiaryUserId:
        input.product === PaymentProduct.subscription
          ? input.beneficiaryUserId ?? input.userId
          : null,
      idempotencyKey: input.idempotencyKey,
      provider: "ton_chain",
      asset: PaymentAsset.FAVOR,
      product: input.product,
      amountNano: new Prisma.Decimal(input.amountNano.toString()),
      quotedPriceUsdt: new Prisma.Decimal(input.quotedPriceUsdt.toFixed(8)),
      senderAddress: input.userWalletAddress,
      senderJettonWalletAddress: senderJettonWallet.toString(),
      recipientAddress: FAVOR_SINK_ADDRESS,
      recipientJettonWalletAddress: recipientJettonWallet.toString(),
      reference,
      expiresAt: input.expiresAt,
      metadata: input.metadata,
    },
  });
}

const claimExpiredFavorSubmission = async ({
  intentId,
  userId,
  boc,
  submittedAt,
}: {
  intentId: string;
  userId: number;
  boc: string;
  submittedAt: Date;
}) => {
  await prisma.paymentIntent.updateMany({
    where: {
      id: intentId,
      userId,
      asset: PaymentAsset.FAVOR,
      status: PaymentIntentStatus.expired,
      boc: null,
    },
    data: { boc, submittedAt },
  });
  const current = await prisma.paymentIntent.findFirst({
    where: { id: intentId, userId, asset: PaymentAsset.FAVOR },
  });
  if (!current) throw new Error("NOT_FOUND");
  if (current.status === PaymentIntentStatus.confirmed) return current;
  if (
    current.status !== PaymentIntentStatus.expired ||
    current.boc !== boc
  ) {
    throw new Error("PAYMENT_SUBMISSION_CONFLICT");
  }

  return current;
};

export async function verifyFavorPaymentIntent({
  intentId,
  userId,
  boc,
}: {
  intentId: string;
  userId: number;
  boc: string;
}) {
  let intent = await prisma.paymentIntent.findFirst({
    where: { id: intentId, userId, asset: PaymentAsset.FAVOR },
  });
  if (!intent) throw new Error("NOT_FOUND");
  if (intent.status === PaymentIntentStatus.confirmed) {
    return { intent, verification: null };
  }
  if (intent.status === PaymentIntentStatus.failed) {
    throw new Error("PAYMENT_FAILED");
  }

  const submittedAt = intent.submittedAt ?? new Date();
  if (intent.status === PaymentIntentStatus.created) {
    const submitted = await prisma.paymentIntent.updateMany({
      where: { id: intent.id, status: PaymentIntentStatus.created },
      data: { status: PaymentIntentStatus.submitted, submittedAt, boc },
    });
    if (submitted.count === 0) {
      const fresh = await prisma.paymentIntent.findFirst({
        where: { id: intent.id, userId, asset: PaymentAsset.FAVOR },
      });
      if (fresh?.status === PaymentIntentStatus.confirmed) {
        return { intent: fresh, verification: null };
      }
      if (fresh?.status === PaymentIntentStatus.expired) {
        intent = await claimExpiredFavorSubmission({
          intentId: intent.id,
          userId,
          boc,
          submittedAt,
        });
        if (intent.status === PaymentIntentStatus.confirmed) {
          return { intent, verification: null };
        }
      } else if (
        fresh?.status !== PaymentIntentStatus.submitted ||
        fresh.boc !== boc
      ) {
        throw new Error("PAYMENT_SUBMISSION_CONFLICT");
      }
      if (fresh?.status === PaymentIntentStatus.submitted) intent = fresh;
    }
  } else if (intent.status === PaymentIntentStatus.expired) {
    intent = await claimExpiredFavorSubmission({
      intentId: intent.id,
      userId,
      boc,
      submittedAt,
    });
    if (intent.status === PaymentIntentStatus.confirmed) {
      return { intent, verification: null };
    }
  } else if (intent.boc !== boc) {
    throw new Error("PAYMENT_SUBMISSION_CONFLICT");
  }
  const verification = await verifyFavorJettonSubscriptionTransaction({
    boc,
    reference: intent.reference,
    expectedFavorAmountNano: BigInt(intent.amountNano.toFixed(0)),
    senderAddress: intent.senderAddress!,
    senderJettonWalletAddress: intent.senderJettonWalletAddress!,
    recipientJettonWalletAddress: intent.recipientJettonWalletAddress!,
  });
  const paidAt = new Date(verification.timestamp * 1000);
  if (
    !Number.isFinite(verification.timestamp) ||
    Number.isNaN(paidAt.getTime()) ||
    paidAt > intent.expiresAt
  ) {
    const expired = await prisma.paymentIntent.updateMany({
      where: {
        id: intent.id,
        status: { not: PaymentIntentStatus.confirmed },
      },
      data: {
        status: PaymentIntentStatus.expired,
        failureReason: "PAYMENT_WINDOW_EXPIRED",
      },
    });
    if (expired.count === 0) {
      const fresh = await prisma.paymentIntent.findUnique({
        where: { id: intent.id },
      });
      if (fresh?.status === PaymentIntentStatus.confirmed) {
        return { intent: fresh, verification: null };
      }
    }
    throw new Error("PAYMENT_WINDOW_EXPIRED");
  }
  return { intent, verification };
}
