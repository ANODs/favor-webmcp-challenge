import {
  PaymentAsset,
  PaymentIntentStatus,
  PaymentProduct,
  PaymentProvider,
} from "@prisma/client";

import { verifyFavorPaymentIntent } from "@/shared/lib/favor-payment/server";
import { prisma } from "@/shared/lib/prisma";
import { verifyTonSubscriptionTransaction } from "@/shared/lib/ton/server";

import {
  favorConfirmationSchema,
  tonConfirmationSchema,
} from "./contracts";
import { fulfillSubscriptionPayment } from "./fulfillment";

const claimExpiredTonSubmission = async ({
  intentId,
  payerUserId,
  boc,
  submittedAt,
}: {
  intentId: string;
  payerUserId: number;
  boc: string;
  submittedAt: Date;
}) => {
  await prisma.paymentIntent.updateMany({
    where: {
      id: intentId,
      userId: payerUserId,
      status: PaymentIntentStatus.expired,
      boc: null,
    },
    data: { boc, submittedAt },
  });
  const current = await prisma.paymentIntent.findFirst({
    where: { id: intentId, userId: payerUserId },
    select: { status: true, boc: true },
  });

  if (current?.status === PaymentIntentStatus.confirmed) return "confirmed";
  if (
    current?.status !== PaymentIntentStatus.expired ||
    current.boc !== boc
  ) {
    throw new Error("PAYMENT_SUBMISSION_CONFLICT");
  }

  return "claimed";
};

export async function confirmTonSubscriptionPayment({
  payerUserId,
  input,
}: {
  payerUserId: number;
  input: unknown;
}) {
  const body = tonConfirmationSchema.parse(input);
  const intent = await prisma.paymentIntent.findFirst({
    where: {
      id: body.paymentIntentId,
      userId: payerUserId,
      provider: PaymentProvider.ton_chain,
      asset: PaymentAsset.GRAM,
      product: PaymentProduct.subscription,
      reference: body.reference,
    },
  });

  if (!intent) throw new Error("NOT_FOUND");
  if (intent.status === PaymentIntentStatus.confirmed) {
    return fulfillSubscriptionPayment({
      intentId: intent.id,
      payerUserId,
      verification: null,
    });
  }
  if (intent.status === PaymentIntentStatus.failed) {
    throw new Error("SUBSCRIPTION_PAYMENT_FAILED");
  }

  const submittedAt = intent.submittedAt ?? new Date();
  if (!intent.senderAddress) throw new Error("TON_PAYMENT_INVALID_SENDER");
  if (!intent.recipientAddress) throw new Error("TON_PAYMENT_INVALID_RECIPIENT");

  if (intent.status === PaymentIntentStatus.created) {
    const submitted = await prisma.paymentIntent.updateMany({
      where: { id: intent.id, status: PaymentIntentStatus.created },
      data: {
        status: PaymentIntentStatus.submitted,
        submittedAt,
        boc: body.boc,
      },
    });
    if (submitted.count === 0) {
      const claimed = await prisma.paymentIntent.findUnique({
        where: { id: intent.id },
        select: { status: true, boc: true },
      });
      if (claimed?.status === PaymentIntentStatus.confirmed) {
        return fulfillSubscriptionPayment({
          intentId: intent.id,
          payerUserId,
          verification: null,
        });
      }
      if (claimed?.status === PaymentIntentStatus.expired) {
        const recovery = await claimExpiredTonSubmission({
          intentId: intent.id,
          payerUserId,
          boc: body.boc,
          submittedAt,
        });
        if (recovery === "confirmed") {
          return fulfillSubscriptionPayment({
            intentId: intent.id,
            payerUserId,
            verification: null,
          });
        }
      } else if (
        claimed?.status !== PaymentIntentStatus.submitted ||
        claimed.boc !== body.boc
      ) {
        throw new Error("PAYMENT_SUBMISSION_CONFLICT");
      }
    }
  } else if (intent.status === PaymentIntentStatus.expired) {
    const recovery = await claimExpiredTonSubmission({
      intentId: intent.id,
      payerUserId,
      boc: body.boc,
      submittedAt,
    });
    if (recovery === "confirmed") {
      return fulfillSubscriptionPayment({
        intentId: intent.id,
        payerUserId,
        verification: null,
      });
    }
  } else if (intent.boc !== body.boc) {
    throw new Error("PAYMENT_SUBMISSION_CONFLICT");
  }
  const verification = await verifyTonSubscriptionTransaction({
    boc: body.boc,
    reference: intent.reference,
    userId: payerUserId,
    expectedAmountNano: BigInt(intent.amountNano.toFixed(0)),
    senderAddress: intent.senderAddress,
    recipientAddress: intent.recipientAddress,
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
      return fulfillSubscriptionPayment({
        intentId: intent.id,
        payerUserId,
        verification: null,
      });
    }
    throw new Error("PAYMENT_WINDOW_EXPIRED");
  }

  return fulfillSubscriptionPayment({
    intentId: intent.id,
    payerUserId,
    verification,
  });
}

export async function confirmFavorSubscriptionPayment({
  payerUserId,
  input,
}: {
  payerUserId: number;
  input: unknown;
}) {
  const body = favorConfirmationSchema.parse(input);
  const intent = await prisma.paymentIntent.findFirst({
    where: {
      id: body.paymentIntentId,
      userId: payerUserId,
      provider: PaymentProvider.ton_chain,
      asset: PaymentAsset.FAVOR,
      product: PaymentProduct.subscription,
    },
    select: { status: true },
  });

  if (!intent) throw new Error("NOT_FOUND");
  if (intent.status === PaymentIntentStatus.confirmed) {
    return fulfillSubscriptionPayment({
      intentId: body.paymentIntentId,
      payerUserId,
      verification: null,
    });
  }

  const verified = await verifyFavorPaymentIntent({
    intentId: body.paymentIntentId,
    userId: payerUserId,
    boc: body.boc,
  });

  return fulfillSubscriptionPayment({
    intentId: body.paymentIntentId,
    payerUserId,
    verification: verified.verification,
  });
}
