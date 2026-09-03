import { AccountRestrictionScope } from "@prisma/client";
import { z } from "zod";

import { createAccountRestriction, requireModeratorCapability } from "@/entities/user/server";
import { handleRouteError, ok } from "@/shared/lib/api";

const schema = z.object({
  scope: z.nativeEnum(AccountRestrictionScope),
  reasonCode: z.string().trim().min(2).max(80),
  publicMessage: z.string().trim().min(3).max(500),
  internalComment: z.string().trim().max(2000).optional().nullable(),
  expiresInHours: z.number().int().positive().max(24 * 365 * 10).optional().nullable(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const moderator = await requireModeratorCapability();
    const { id } = await params;
    const targetUserId = Number(id);

    if (!Number.isSafeInteger(targetUserId) || targetUserId <= 0) {
      throw new Error("INVALID_ACCOUNT_ID");
    }

    const body = schema.parse(await request.json());
    const expiresAt = body.expiresInHours
      ? new Date(Date.now() + body.expiresInHours * 60 * 60 * 1000)
      : null;
    const restriction = await createAccountRestriction({
      targetUserId,
      moderatorId: moderator.id,
      scope: body.scope,
      reasonCode: body.reasonCode,
      publicMessage: body.publicMessage,
      internalComment: body.internalComment,
      expiresAt,
    });

    return ok(restriction, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
