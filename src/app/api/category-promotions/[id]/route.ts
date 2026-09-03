import { z } from "zod";

import { handleRouteError, ok } from "@/shared/lib/api";
import { requireUser } from "@/shared/lib/auth";
import { prisma } from "@/shared/lib/prisma";

const schema = z.object({ contractId: z.number().int().positive().nullable() });
type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const promotionId = Number((await params).id);
    const { contractId } = schema.parse(await request.json());
    const now = new Date();

    const promotion = await prisma.categoryPromotion.findFirst({
      where: { id: promotionId, userId: user.id, startsAt: { lte: now }, endsAt: { gt: now } },
    });
    if (!promotion) throw new Error("NOT_FOUND");

    if (contractId !== null) {
      const contract = await prisma.contract.findFirst({
        where: {
          id: contractId,
          authorId: user.id,
          category: promotion.categoryKey,
          status: "active",
        },
        select: { id: true },
      });
      if (!contract) throw new Error("CONTRACT_CATEGORY_MISMATCH");
    }

    const updated = await prisma.categoryPromotion.update({
      where: { id: promotion.id },
      data: { assignedContractId: contractId },
    });
    return ok(updated);
  } catch (error) {
    return handleRouteError(error);
  }
}
