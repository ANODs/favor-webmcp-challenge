import { PaymentProduct, Prisma } from "@prisma/client";
import { z } from "zod";

import { handleRouteError, ok } from "@/shared/lib/api";
import { requireUser } from "@/shared/lib/auth";
import { prisma } from "@/shared/lib/prisma";
import { safeParseAddress } from "@/shared/lib/ton";
import { getFavorPriceUsdt } from "@/shared/lib/ton/oracle";
import {
  AUCTION_MAX_PAYMENT_ATTEMPTS,
  getFavorBalanceNano,
  notifyAuctionParticipants,
  reconcileCategoryAuction,
} from "@/features/category-auction/server";
import { prepareFavorPaymentIntent } from "@/shared/lib/favor-payment/server";

const schema = z.object({
  userWalletAddress: z.string().min(1),
});

type Params = { params: Promise<{ id: string }> };

const paymentResponse = (intent: {
  id: string;
  recipientAddress: string | null;
  senderJettonWalletAddress: string | null;
  amountNano: Prisma.Decimal;
  reference: string;
  expiresAt: Date;
}) => ({
  paymentIntentId: intent.id,
  recipientAddress: intent.recipientAddress,
  userJettonWalletAddress: intent.senderJettonWalletAddress,
  amountNano: intent.amountNano.toFixed(0),
  reference: intent.reference,
  expiresAt: intent.expiresAt,
  serverTime: Math.floor(Date.now() / 1000),
});

export async function POST(request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const auctionId = Number((await params).id);
    const input = schema.parse(await request.json());
    const now = new Date();
    await reconcileCategoryAuction(auctionId, now);

    if (!user.walletAddress || !safeParseAddress(user.walletAddress).equals(safeParseAddress(input.userWalletAddress))) {
      throw new Error("WALLET_DOES_NOT_MATCH_ACCOUNT");
    }

    const auction = await prisma.categoryAuction.findUnique({
      where: { id: auctionId },
      include: {
        bids: {
          where: { userId: user.id },
          include: { paymentAttempts: { include: { paymentIntent: true }, orderBy: { attemptNumber: "asc" } } },
        },
      },
    });
    const bid = auction?.bids[0];
    if (
      !auction ||
      !bid ||
      auction.status !== "awaiting_payment" ||
      auction.currentCandidateBidId !== bid.id ||
      !auction.paymentDeadlineAt ||
      auction.paymentDeadlineAt <= now
    ) {
      throw new Error("NOT_CURRENT_PAYMENT_CANDIDATE");
    }

    const lastAttempt = bid.paymentAttempts.at(-1);
    if (lastAttempt?.paymentIntent.status === "created") {
      return ok(paymentResponse(lastAttempt.paymentIntent));
    }
    const submittedAttempts = bid.paymentAttempts.filter(
      (attempt) => attempt.paymentIntent.status !== "created",
    ).length;
    if (submittedAttempts >= AUCTION_MAX_PAYMENT_ATTEMPTS) {
      throw new Error("PAYMENT_ATTEMPTS_EXHAUSTED");
    }

    const amountNano = BigInt(bid.amountNano.toFixed(0));
    if (await getFavorBalanceNano(input.userWalletAddress) < amountNano) {
      throw new Error("INSUFFICIENT_FAVOR_BALANCE");
    }
    const favorPriceUsdt = await getFavorPriceUsdt();
    const quotedPriceUsdt = new Prisma.Decimal(amountNano.toString())
      .div(1_000_000_000)
      .mul(favorPriceUsdt)
      .toNumber();
    const intent = await prepareFavorPaymentIntent({
      userId: user.id,
      userWalletAddress: input.userWalletAddress,
      amountNano,
      quotedPriceUsdt,
      product: PaymentProduct.category_auction_bid,
      expiresAt: auction.paymentDeadlineAt,
      metadata: { auctionId, bidId: bid.id },
    });

    try {
      await prisma.auctionPaymentAttempt.create({
        data: {
          bidId: bid.id,
          paymentIntentId: intent.id,
          attemptNumber: bid.paymentAttempts.length + 1,
        },
      });
    } catch (error) {
      await prisma.paymentIntent.update({
        where: { id: intent.id },
        data: { status: "failed", failureReason: "ATTEMPT_CREATION_RACE" },
      });
      throw error;
    }

    if (submittedAttempts > 0) {
      await notifyAuctionParticipants(
        auctionId,
        "secondPaymentAttempt",
      );
    }

    return ok(paymentResponse(intent));
  } catch (error) {
    return handleRouteError(error);
  }
}
