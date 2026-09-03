import { Prisma } from "@prisma/client";
import { z } from "zod";

import { handleRouteError, ok } from "@/shared/lib/api";
import { requireUser } from "@/shared/lib/auth";
import { prisma } from "@/shared/lib/prisma";
import { safeParseAddress } from "@/shared/lib/ton";
import {
  extendAuctionDeadline,
  getAuctionStartQuote,
  getFavorBalanceNano,
  minimumNextBidNano,
  notifyAuctionParticipants,
  reconcileCategoryAuction,
} from "@/features/category-auction/server";

const bidSchema = z.object({
  amountNano: z.string().regex(/^\d+$/),
  userWalletAddress: z.string().min(1),
  contractId: z.number().int().positive().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const auctionId = Number((await params).id);
    const input = bidSchema.parse(await request.json());
    const amountNano = BigInt(input.amountNano);
    const now = new Date();

    await reconcileCategoryAuction(auctionId, now);
    const startQuote = await getAuctionStartQuote();
    if (!user.walletAddress || !safeParseAddress(user.walletAddress).equals(safeParseAddress(input.userWalletAddress))) {
      throw new Error("WALLET_DOES_NOT_MATCH_ACCOUNT");
    }
    if (await getFavorBalanceNano(input.userWalletAddress) < amountNano) {
      throw new Error("INSUFFICIENT_FAVOR_BALANCE");
    }

    const result = await prisma.$transaction(async (tx) => {
      const auction = await tx.categoryAuction.findUnique({ where: { id: auctionId } });
      if (!auction) throw new Error("NOT_FOUND");
      if (auction.status !== "open" || auction.biddingEndsAt <= now) {
        throw new Error("AUCTION_BIDDING_CLOSED");
      }

      const anotherAuction = await tx.categoryAuctionBid.findFirst({
        where: {
          userId: user.id,
          auctionId: { not: auctionId },
          auction: { status: { in: ["open", "awaiting_payment"] } },
        },
        select: { id: true },
      });
      const activePromotion = await tx.categoryPromotion.findFirst({
        where: {
          userId: user.id,
          startsAt: { lte: now },
          endsAt: { gt: now },
        },
        select: { id: true },
      });
      if (anotherAuction || activePromotion) throw new Error("ONLY_ONE_AUCTION_AT_A_TIME");

      const leader = await tx.categoryAuctionBid.findFirst({
        where: { auctionId, status: "active" },
        orderBy: [{ amountNano: "desc" }, { placedAt: "asc" }],
      });
      const leaderNano = leader ? BigInt(leader.amountNano.toFixed(0)) : 0n;
      const minimum = leaderNano === 0n ? startQuote.amountNano : minimumNextBidNano(leaderNano);
      if (!leader || amountNano < minimum) {
        throw new Error("BID_MUST_BE_AT_LEAST_10_PERCENT_HIGHER");
      }

      if (input.contractId) {
        const contract = await tx.contract.findFirst({
          where: {
            id: input.contractId,
            authorId: user.id,
            category: auction.categoryKey,
            status: "active",
          },
          select: { id: true },
        });
        if (!contract) throw new Error("CONTRACT_CATEGORY_MISMATCH");
      }

      const previous = await tx.categoryAuctionBid.findUnique({
        where: { auctionId_userId: { auctionId, userId: user.id } },
      });
      const bid = await tx.categoryAuctionBid.upsert({
        where: { auctionId_userId: { auctionId, userId: user.id } },
        create: {
          auctionId,
          userId: user.id,
          contractId: input.contractId,
          amountNano: new Prisma.Decimal(amountNano.toString()),
          placedAt: now,
        },
        update: {
          contractId: input.contractId,
          amountNano: new Prisma.Decimal(amountNano.toString()),
          status: "active",
          placedAt: now,
        },
      });
      await tx.categoryAuctionBidEvent.create({
        data: {
          bidId: bid.id,
          amountNano: new Prisma.Decimal(amountNano.toString()),
          previousAmountNano: previous?.amountNano,
        },
      });
      const biddingEndsAt = extendAuctionDeadline(auction.biddingEndsAt, now);
      await tx.categoryAuction.update({ where: { id: auctionId }, data: { biddingEndsAt } });
      return { bid, biddingEndsAt };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    await notifyAuctionParticipants(auctionId, "newLeadingBid", {
      amount: Number(amountNano) / 1e9,
    });
    return ok({ amountNano: result.bid.amountNano, biddingEndsAt: result.biddingEndsAt });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      ["P2002", "P2034"].includes(error.code)
    ) {
      return handleRouteError(new Error("BID_RACE_LOST"));
    }
    return handleRouteError(error);
  }
}
