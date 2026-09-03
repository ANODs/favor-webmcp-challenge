import {
  CategoryAuctionStatus,
  PaymentIntentStatus,
  Prisma,
} from "@prisma/client";

import { env } from "@/shared/config/env";
import { prisma } from "@/shared/lib/prisma";
import { sendTelegramBotMessage } from "@/shared/lib/telegram";
import { normalizeTelegramMessageLocale } from "@/shared/lib/telegram/locale.server";
import { getFavorPriceUsdt } from "@/shared/lib/ton/oracle";
import { getJettonWalletAddress, getJettonWalletBalance } from "@/shared/lib/ton/server";
import { verifyFavorPaymentIntent } from "@/shared/lib/favor-payment/server";
import {
  AUCTION_MAX_PAYMENT_ATTEMPTS,
  AUCTION_BIDDING_DURATION_MS,
  AUCTION_PAYMENT_WINDOW_MS,
  auctionStartAmountNano,
  extendAuctionDeadline,
  minimumNextBidNano,
  promotionEndsAt,
} from "./model/rules";
import englishMessages from "./messages.en.json";
import russianMessages from "./messages.ru.json";

type AuctionNotificationKey = Exclude<
  keyof typeof englishMessages,
  "openFavor"
>;

const getAuctionMessages = (languageCode: string | null) =>
  normalizeTelegramMessageLocale(languageCode) === "en"
    ? englishMessages
    : russianMessages;

const formatAuctionMessage = (
  template: string,
  values: Record<string, string | number>,
) =>
  Object.entries(values).reduce(
    (message, [key, value]) => message.replaceAll(`{${key}}`, String(value)),
    template,
  );

export async function getFavorBalanceNano(ownerAddress: string) {
  try {
    const wallet = await getJettonWalletAddress({
      masterAddress: env.requireFavorJettonMasterAddress(),
      ownerAddress,
    });
    return await getJettonWalletBalance(wallet.toString());
  } catch (error) {
    console.warn("[getFavorBalanceNano] unavailable wallet is treated as zero balance", error);
    return 0n;
  }
}

export async function getAuctionStartQuote() {
  const favorPriceUsdt = await getFavorPriceUsdt();
  return {
    favorPriceUsdt,
    amountNano: auctionStartAmountNano({
      targetUsdt: env.auctionStartPriceUsdt,
      favorPriceUsdt,
      maxFavor: env.auctionMaxStartFavor,
    }),
    targetUsdt: env.auctionStartPriceUsdt,
  };
}

export async function notifyAuctionParticipants(
  auctionId: number,
  messageKey: AuctionNotificationKey,
  values: Record<string, string | number> = {},
) {
  const participants = await prisma.categoryAuctionBid.findMany({
    where: { auctionId },
    distinct: ["userId"],
    select: { user: { select: { telegramId: true, languageCode: true } } },
  });

  await Promise.allSettled(
    participants.map(({ user }) => {
      const messages = getAuctionMessages(user.languageCode);
      return sendTelegramBotMessage({
        chatId: user.telegramId.toString(),
        text: formatAuctionMessage(messages[messageKey], values),
        buttons: [{ text: messages.openFavor, url: env.baseUrl }],
      });
    }),
  );
}

const settleFreePromotion = async (
  tx: Prisma.TransactionClient,
  auction: {
    id: number;
    categoryKey: string;
    categoryName: string;
    premiumFreeStart: boolean;
    starterId: number;
  },
  bid: { id: number; userId: number; contractId: number | null },
  startsAt: Date,
) => {
  if (!auction.premiumFreeStart || bid.userId !== auction.starterId) {
    throw new Error("INVALID_FREE_AUCTION_WINNER");
  }

  const assignedContract = bid.contractId
    ? await tx.contract.findFirst({
        where: {
          id: bid.contractId,
          authorId: bid.userId,
          category: auction.categoryKey,
          status: "active",
        },
        select: { id: true },
      })
    : await tx.contract.findFirst({
        where: {
          authorId: bid.userId,
          category: auction.categoryKey,
          status: "active",
        },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });

  await tx.categoryPromotion.create({
    data: {
      userId: bid.userId,
      categoryKey: auction.categoryKey,
      categoryName: auction.categoryName,
      auctionId: auction.id,
      assignedContractId: assignedContract?.id,
      source: "premium_free",
      startsAt,
      endsAt: promotionEndsAt(startsAt),
    },
  });
  await tx.categoryAuctionBid.update({
    where: { id: bid.id },
    data: { status: "winner" },
  });
  await tx.categoryAuction.update({
    where: { id: auction.id },
    data: {
      status: "settled",
      winnerUserId: bid.userId,
      currentCandidateBidId: bid.id,
      settledAt: startsAt,
      paymentDeadlineAt: null,
    },
  });
};

export async function confirmCategoryAuctionPayment({
  intentId,
  userId,
  boc,
}: {
  intentId: string;
  userId: number;
  boc: string;
}) {
  const candidate = await prisma.paymentIntent.findFirst({
    where: { id: intentId, userId, product: "category_auction_bid" },
    include: {
      auctionPaymentAttempt: {
        include: { bid: { include: { auction: true } } },
      },
    },
  });
  const bid = candidate?.auctionPaymentAttempt?.bid;
  const auction = bid?.auction;
  if (!candidate || !bid || !auction) throw new Error("NOT_FOUND");
  if (candidate.status === "confirmed") {
    return { confirmed: true, transactionHash: candidate.txHash, newlyConfirmed: false };
  }
  const submittedAt = candidate.submittedAt ?? new Date();
  if (
    auction.status !== "awaiting_payment" ||
    auction.currentCandidateBidId !== bid.id ||
    !auction.paymentDeadlineAt ||
    submittedAt > auction.paymentDeadlineAt
  ) {
    throw new Error("AUCTION_PAYMENT_TURN_EXPIRED");
  }

  const verified = await verifyFavorPaymentIntent({ intentId, userId, boc });
  if (!verified.verification) {
    return { confirmed: true, transactionHash: verified.intent.txHash, newlyConfirmed: false };
  }
  const txTimestamp = new Date(verified.verification.timestamp * 1000);

  try {
    return await prisma.$transaction(async (tx) => {
      const fresh = await tx.paymentIntent.findUnique({
        where: { id: intentId },
        include: {
          auctionPaymentAttempt: {
            include: { bid: { include: { auction: true } } },
          },
        },
      });
      const freshBid = fresh?.auctionPaymentAttempt?.bid;
      const freshAuction = freshBid?.auction;
      if (!fresh || !freshBid || !freshAuction) throw new Error("NOT_FOUND");
      if (fresh.status === "confirmed") {
        return { confirmed: true, transactionHash: fresh.txHash, newlyConfirmed: false };
      }
      if (
        freshAuction.status !== "awaiting_payment" ||
        freshAuction.currentCandidateBidId !== freshBid.id
      ) {
        throw new Error("AUCTION_PAYMENT_TURN_EXPIRED");
      }

      const assignedContract = freshBid.contractId
        ? await tx.contract.findFirst({
            where: {
              id: freshBid.contractId,
              authorId: freshBid.userId,
              category: freshAuction.categoryKey,
              status: "active",
            },
            select: { id: true },
          })
        : await tx.contract.findFirst({
            where: {
              authorId: freshBid.userId,
              category: freshAuction.categoryKey,
              status: "active",
            },
            orderBy: { createdAt: "desc" },
            select: { id: true },
          });

      await tx.categoryPromotion.create({
        data: {
          userId: freshBid.userId,
          categoryKey: freshAuction.categoryKey,
          categoryName: freshAuction.categoryName,
          auctionId: freshAuction.id,
          assignedContractId: assignedContract?.id,
          source: "paid_auction",
          startsAt: txTimestamp,
          endsAt: promotionEndsAt(txTimestamp),
        },
      });
      await tx.categoryAuctionBid.update({
        where: { id: freshBid.id },
        data: { status: "winner" },
      });
      await tx.categoryAuction.update({
        where: { id: freshAuction.id },
        data: {
          status: "settled",
          winnerUserId: freshBid.userId,
          settledAt: txTimestamp,
          paymentDeadlineAt: null,
        },
      });
      await tx.paymentIntent.update({
        where: { id: fresh.id },
        data: {
          status: "confirmed",
          txHash: verified.verification.transactionHash,
          txTimestamp,
          confirmedAt: new Date(),
        },
      });
      return {
        confirmed: true,
        transactionHash: verified.verification.transactionHash,
        newlyConfirmed: true,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    const confirmed = await prisma.paymentIntent.findFirst({
      where: {
        id: intentId,
        userId,
        product: "category_auction_bid",
        status: "confirmed",
      },
      select: { txHash: true },
    });
    if (confirmed) {
      return { confirmed: true, transactionHash: confirmed.txHash, newlyConfirmed: false };
    }
    throw error;
  }
}

async function advanceAuctionCandidate(auctionId: number, now: Date) {
  return prisma.$transaction(async (tx) => {
    const auction = await tx.categoryAuction.findUnique({ where: { id: auctionId } });
    if (!auction || auction.status !== CategoryAuctionStatus.open || auction.currentCandidateBidId !== null) {
      return null;
    }

    const bid = await tx.categoryAuctionBid.findFirst({
      where: { auctionId, status: "active" },
      orderBy: [{ amountNano: "desc" }, { placedAt: "asc" }],
    });
    if (!bid) {
      await tx.categoryAuction.update({
        where: { id: auctionId },
        data: { status: "cancelled", paymentDeadlineAt: null, currentCandidateBidId: null },
      });
      return { type: "cancelled" as const };
    }

    if (BigInt(bid.amountNano.toFixed(0)) === 0n) {
      await settleFreePromotion(tx, auction, bid, now);
      return { type: "settled_free" as const, userId: bid.userId };
    }

    await tx.categoryAuctionBid.update({
      where: { id: bid.id },
      data: { status: "awaiting_payment" },
    });
    await tx.categoryAuction.update({
      where: { id: auctionId },
      data: {
        status: "awaiting_payment",
        currentCandidateBidId: bid.id,
        paymentDeadlineAt: new Date(now.getTime() + AUCTION_PAYMENT_WINDOW_MS),
      },
    });
    return { type: "awaiting_payment" as const, userId: bid.userId };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function reconcileCategoryAuction(auctionId: number, now = new Date()) {
  const auction = await prisma.categoryAuction.findUnique({
    where: { id: auctionId },
    include: {
      bids: {
        include: { paymentAttempts: { include: { paymentIntent: true } } },
      },
    },
  });
  if (!auction || auction.status === "settled" || auction.status === "cancelled") {
    return auction?.status ?? null;
  }

  if (auction.status === "open") {
    if (auction.biddingEndsAt > now) {
      return auction.status;
    }
    const transition = await advanceAuctionCandidate(auction.id, now);
    if (transition?.type === "awaiting_payment") {
      await notifyAuctionParticipants(auction.id, "auctionAwaitingPayment");
    } else if (transition?.type === "settled_free") {
      await notifyAuctionParticipants(auction.id, "freeBidWon");
    } else if (transition?.type === "cancelled") {
      await notifyAuctionParticipants(auction.id, "auctionCancelled");
    }
    return transition?.type ?? null;
  }

  if (!auction.paymentDeadlineAt || auction.paymentDeadlineAt > now) {
    return auction.status;
  }

  const candidate = auction.bids.find((bid) => bid.id === auction.currentCandidateBidId);
  if (candidate) {
    for (const attempt of candidate.paymentAttempts) {
      const intent = attempt.paymentIntent;
      if (intent.status === "submitted" && intent.boc && intent.submittedAt && intent.submittedAt <= auction.paymentDeadlineAt) {
        try {
          const confirmation = await confirmCategoryAuctionPayment({
            intentId: intent.id,
            userId: candidate.userId,
            boc: intent.boc,
          });
          if (confirmation.newlyConfirmed) {
            await notifyAuctionParticipants(auction.id, "paymentConfirmed");
          }
          return "settled";
        } catch (error) {
          console.warn("[reconcileCategoryAuction] submitted payment was not found", error);
        }
      }
    }

    const released = await prisma.$transaction(async (tx) => {
      const freshAuction = await tx.categoryAuction.findUnique({ where: { id: auction.id } });
      if (
        !freshAuction ||
        freshAuction.status !== "awaiting_payment" ||
        freshAuction.currentCandidateBidId !== candidate.id ||
        !freshAuction.paymentDeadlineAt ||
        freshAuction.paymentDeadlineAt > now
      ) {
        return false;
      }
      await tx.categoryAuctionBid.update({
        where: { id: candidate.id },
        data: { status: "payment_failed" },
      });
      await tx.paymentIntent.updateMany({
        where: {
          auctionPaymentAttempt: { bidId: candidate.id },
          status: { in: [PaymentIntentStatus.created, PaymentIntentStatus.submitted] },
        },
        data: { status: PaymentIntentStatus.expired, failureReason: "PAYMENT_WINDOW_EXPIRED" },
      });
      await tx.categoryAuction.update({
        where: { id: auction.id },
        data: { status: "open", currentCandidateBidId: null, paymentDeadlineAt: null },
      });
      return true;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (!released) return "awaiting_payment";
  }

  const transition = await advanceAuctionCandidate(auction.id, now);
  if (transition?.type === "awaiting_payment") {
    await notifyAuctionParticipants(auction.id, "nextCandidate");
  } else if (transition?.type === "settled_free") {
    await notifyAuctionParticipants(auction.id, "freeBidWonAfterFailures");
  } else {
    await notifyAuctionParticipants(auction.id, "allPaymentsFailed");
  }
  return transition?.type ?? null;
}

export async function reconcileDueCategoryAuctions(limit = 25) {
  const now = new Date();
  const due = await prisma.categoryAuction.findMany({
    where: {
      OR: [
        { status: "open", biddingEndsAt: { lte: now } },
        { status: "awaiting_payment", paymentDeadlineAt: { lte: now } },
      ],
    },
    orderBy: { updatedAt: "asc" },
    take: limit,
    select: { id: true },
  });

  return Promise.allSettled(due.map(({ id }) => reconcileCategoryAuction(id, now)));
}

export {
  AUCTION_BIDDING_DURATION_MS,
  AUCTION_MAX_PAYMENT_ATTEMPTS,
  extendAuctionDeadline,
  minimumNextBidNano,
};
