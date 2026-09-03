import { z } from "zod";

import {
  parseUserBadgeCatalogCursor,
  USER_BADGE_ICON_KEYS,
  USER_BADGE_TONES,
} from "@/entities/user";
import {
  createAndAssignUserBadgeDefinition,
  createUserBadgeDefinition,
  listUserBadgeDefinitions,
  requireModeratorCapability,
} from "@/entities/user/server";
import { handleRouteError, ok } from "@/shared/lib/api";

const createUserBadgeSchema = z
  .object({
    labelRu: z.string().trim().min(1).max(48),
    labelEn: z.string().trim().min(1).max(48),
    descriptionRu: z.string().trim().min(3).max(240),
    descriptionEn: z.string().trim().min(3).max(240),
    iconKey: z.enum(USER_BADGE_ICON_KEYS),
    tone: z.enum(USER_BADGE_TONES),
    sortOrder: z.number().int().min(-10_000).max(10_000).optional(),
    targetUserId: z.number().int().positive().optional(),
  })
  .strict();

export async function GET(request: Request) {
  try {
    await requireModeratorCapability();
    const cursor = parseUserBadgeCatalogCursor(
      new URL(request.url).searchParams.get("cursor"),
    );

    return ok(await listUserBadgeDefinitions(cursor));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const moderator = await requireModeratorCapability();
    const input = createUserBadgeSchema.parse(await request.json());
    const { targetUserId, ...badgeInput } = input;
    const badge = targetUserId
      ? await createAndAssignUserBadgeDefinition(
          badgeInput,
          targetUserId,
          moderator.id,
        )
      : await createUserBadgeDefinition(badgeInput, moderator.id);

    return ok(badge, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
