import { z } from "zod";

import { requireModeratorCapability, revokeAccountRestriction } from "@/entities/user/server";
import { handleRouteError, ok } from "@/shared/lib/api";

const schema = z.object({
  comment: z.string().trim().min(3).max(1000),
});

export async function POST(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ id: string; restrictionId: string }>;
  },
) {
  try {
    const moderator = await requireModeratorCapability();
    const { id, restrictionId } = await params;
    const targetUserId = Number(id);
    const parsedRestrictionId = Number(restrictionId);

    if (
      !Number.isSafeInteger(targetUserId) ||
      targetUserId <= 0 ||
      !Number.isSafeInteger(parsedRestrictionId) ||
      parsedRestrictionId <= 0
    ) {
      throw new Error("INVALID_RESTRICTION_ID");
    }

    const body = schema.parse(await request.json());
    const restriction = await revokeAccountRestriction({
      targetUserId,
      restrictionId: parsedRestrictionId,
      moderatorId: moderator.id,
      comment: body.comment,
    });

    return ok(restriction);
  } catch (error) {
    return handleRouteError(error);
  }
}
