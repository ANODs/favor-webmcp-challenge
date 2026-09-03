import { Prisma } from "@prisma/client";
import { z } from "zod";

import { getCategoryLabel, resolveCategoryId } from "@/entities/category";
import { handleRouteError, ok } from "@/shared/lib/api";
import { getCurrentUser, requireUser } from "@/shared/lib/auth";
import { prisma } from "@/shared/lib/prisma";
import { safeParseAddress } from "@/shared/lib/ton";
import { buildTelegramAvatarProxyUrl } from "@/shared/lib/telegram/avatar";
import {
  getAuctionStartQuote,
  getFavorBalanceNano,
  notifyAuctionParticipants,
  reconcileCategoryAuction,
  AUCTION_BIDDING_DURATION_MS,
} from "@/features/category-auction/server";

const startSchema = z.object({
  categoryName: z.string().trim().min(1).max(120),
  contractId: z.number().int().positive().optional(),
  amountNano: z.string().regex(/^\d+$/).optional(),
  userWalletAddress: z.string().min(1).optional(),
  usePremiumFree: z.boolean().default(false),
});

const publicAuctionInclude = {
  bids: {
    orderBy: [{ amountNano: "desc" as const }, { placedAt: "asc" as const }],
    select: {
      id: true,
      userId: true,
      amountNano: true,
      status: true,
      placedAt: true,
      user: {
        select: {
          name: true,
          telegramId: true,
          telegramUsername: true,
          isTelegramUsernameHidden: true,
        },
      },
    },
  },
} satisfies Prisma.CategoryAuctionInclude;

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    const params = new URL(request.url).searchParams;
    const requestedCategory = params.get("category")?.trim() ?? "";
    const categoryId = resolveCategoryId(requestedCategory);
    const auctionId = Number(params.get("auctionId"));
    const now = new Date();

    let auction = await prisma.categoryAuction.findFirst({
      where: Number.isInteger(auctionId) && auctionId > 0
        ? { id: auctionId }
        : categoryId
          ? { categoryKey: categoryId, status: { in: ["open", "awaiting_payment"] } }
          : { id: -1 },
      include: publicAuctionInclude,
      orderBy: { createdAt: "desc" },
    });

    if (auction && (
      (auction.status === "open" && auction.biddingEndsAt <= now) ||
      (auction.status === "awaiting_payment" && auction.paymentDeadlineAt && auction.paymentDeadlineAt <= now)
    )) {
      await reconcileCategoryAuction(auction.id, now);
      auction = await prisma.categoryAuction.findUnique({
        where: { id: auction.id },
        include: publicAuctionInclude,
      });
    }

    const [
      quote,
      premiumFreePromotion,
      categoryPromotion,
      participation,
      activePromotion,
    ] = await Promise.all([
      getAuctionStartQuote(),
      user
        ? prisma.categoryPromotion.findFirst({
            where: { userId: user.id, source: "premium_free", endsAt: { gt: now } },
            select: { id: true },
          })
        : null,
      categoryId
        ? prisma.categoryPromotion.findFirst({
            where: {
              categoryKey: categoryId,
              startsAt: { lte: now },
              endsAt: { gt: now },
            },
            select: { endsAt: true },
          })
        : null,
      user
        ? prisma.categoryAuctionBid.findFirst({
            where: {
              userId: user.id,
              auction: { status: { in: ["open", "awaiting_payment"] } },
            },
            select: { auctionId: true },
          })
        : null,
      user
        ? prisma.categoryPromotion.findFirst({
            where: {
              userId: user.id,
              startsAt: { lte: now },
              endsAt: { gt: now },
            },
            select: { auctionId: true },
          })
        : null,
    ]);
    const currentUserPaymentAttempts = user && auction
      ? await prisma.auctionPaymentAttempt.count({
          where: {
            bid: { auctionId: auction.id, userId: user.id },
            paymentIntent: { status: { not: "created" } },
          },
        })
      : 0;
    const publicAuction = auction
      ? {
          ...auction,
          bids: auction.bids.map(({ user: bidUser, ...bid }) => ({
            ...bid,
            user: {
              name: bidUser.name,
              telegramUsername: bidUser.isTelegramUsernameHidden
                ? null
                : bidUser.telegramUsername,
              avatarUrl: buildTelegramAvatarProxyUrl(bidUser.telegramId),
            },
          })),
        }
      : null;
    return ok({
      auction: publicAuction,
      currentUserId: user?.id ?? null,
      startAmountNano: quote.amountNano.toString(),
      startTargetUsdt: quote.targetUsdt,
      favorPriceUsdt: quote.favorPriceUsdt,
      premiumFreeAvailable: Boolean(
        user?.isPremium && user.premiumExpiresAt && user.premiumExpiresAt > now && !premiumFreePromotion,
      ),
      participatingAuctionId: participation?.auctionId ?? activePromotion?.auctionId ?? null,
      categoryPromotionEndsAt: categoryPromotion?.endsAt ?? null,
      currentUserPaymentAttempts,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const input = startSchema.parse(await request.json());
    const now = new Date();
    const categoryKey = resolveCategoryId(input.categoryName);
    if (!categoryKey) throw new Error("UNKNOWN_CATEGORY");
    const categoryName = getCategoryLabel(categoryKey, "ru") ?? categoryKey;
    const amountNano = input.usePremiumFree ? 0n : BigInt(input.amountNano ?? "0");
    const quote = await getAuctionStartQuote();

    if (!input.usePremiumFree) {
      if (!input.userWalletAddress || !user.walletAddress) {
        throw new Error("CONNECT_FAVOR_WALLET");
      }
      if (!safeParseAddress(input.userWalletAddress).equals(safeParseAddress(user.walletAddress))) {
        throw new Error("WALLET_DOES_NOT_MATCH_ACCOUNT");
      }
      if (amountNano < quote.amountNano) {
        throw new Error("BID_BELOW_DYNAMIC_START_PRICE");
      }
      if (await getFavorBalanceNano(input.userWalletAddress) < amountNano) {
        throw new Error("INSUFFICIENT_FAVOR_BALANCE");
      }
    }

    const auction = await prisma.$transaction(async (tx) => {
      const occupied = await tx.categoryAuction.findFirst({
        where: { categoryKey, status: { in: ["open", "awaiting_payment"] } },
        select: { id: true },
      });
      const promoted = await tx.categoryPromotion.findFirst({
        where: { categoryKey, startsAt: { lte: now }, endsAt: { gt: now } },
        select: { id: true },
      });
      if (occupied || promoted) throw new Error("CATEGORY_ALREADY_OCCUPIED");

      const anotherAuction = await tx.categoryAuctionBid.findFirst({
        where: {
          userId: user.id,
          auction: { status: { in: ["open", "awaiting_payment"] } },
        },
        select: { auctionId: true },
      });
      const anotherPromotion = await tx.categoryPromotion.findFirst({
        where: {
          userId: user.id,
          startsAt: { lte: now },
          endsAt: { gt: now },
        },
        select: { id: true },
      });
      if (anotherAuction || anotherPromotion) throw new Error("ONLY_ONE_AUCTION_AT_A_TIME");

      if (input.usePremiumFree) {
        if (!user.isPremium || !user.premiumExpiresAt || user.premiumExpiresAt <= now) {
          throw new Error("FAVOR_PLUS_REQUIRED");
        }
        const usedQuota = await tx.categoryPromotion.findFirst({
          where: { userId: user.id, source: "premium_free", endsAt: { gt: now } },
          select: { id: true },
        });
        if (usedQuota) throw new Error("PREMIUM_FREE_AUCTION_ALREADY_USED");
      }

      if (input.contractId) {
        const contract = await tx.contract.findFirst({
          where: {
            id: input.contractId,
            authorId: user.id,
            category: categoryKey,
            status: "active",
          },
          select: { id: true },
        });
        if (!contract) throw new Error("CONTRACT_CATEGORY_MISMATCH");
      }

      const created = await tx.categoryAuction.create({
        data: {
          categoryKey,
          categoryName,
          starterId: user.id,
          premiumFreeStart: input.usePremiumFree,
          startsAt: now,
          biddingEndsAt: new Date(now.getTime() + AUCTION_BIDDING_DURATION_MS),
        },
      });
      const bid = await tx.categoryAuctionBid.create({
        data: {
          auctionId: created.id,
          userId: user.id,
          contractId: input.contractId,
          amountNano: new Prisma.Decimal(amountNano.toString()),
          placedAt: now,
        },
      });
      await tx.categoryAuctionBidEvent.create({
        data: { bidId: bid.id, amountNano: new Prisma.Decimal(amountNano.toString()) },
      });
      return created;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    await notifyAuctionParticipants(
      auction.id,
      input.usePremiumFree
        ? "auctionStartedFree"
        : "auctionStarted",
    );
    return ok({ auctionId: auction.id }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
