import { z } from "zod";

import { handleRouteError, ok } from "@/shared/lib/api";
import { requireUser } from "@/shared/lib/auth";
import {
  confirmCategoryAuctionPayment,
  notifyAuctionParticipants,
} from "@/features/category-auction/server";
import { prisma } from "@/shared/lib/prisma";

const schema = z.object({ boc: z.string().min(1) });
type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const intentId = (await params).id;
    const { boc } = schema.parse(await request.json());
    const result = await confirmCategoryAuctionPayment({ intentId, userId: user.id, boc });
    const attempt = await prisma.auctionPaymentAttempt.findUnique({
      where: { paymentIntentId: intentId },
      select: { bid: { select: { auctionId: true } } },
    });
    if (attempt && result.newlyConfirmed) {
      await notifyAuctionParticipants(
        attempt.bid.auctionId,
        "paymentConfirmed",
      );
    }
    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
