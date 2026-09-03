import {
  assignUserBadge,
  removeUserBadge,
  requireModeratorCapability,
} from "@/entities/user/server";
import { handleRouteError, ok } from "@/shared/lib/api";

const parsePositiveId = (value: string) => {
  const id = Number(value);

  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error("INVALID_BADGE_ASSIGNMENT_ID");
  }

  return id;
};

type BadgeAssignmentRouteContext = {
  params: Promise<{ id: string; badgeId: string }>;
};

export async function PUT(
  _request: Request,
  { params }: BadgeAssignmentRouteContext,
) {
  try {
    const moderator = await requireModeratorCapability();
    const routeParams = await params;
    const targetUserId = parsePositiveId(routeParams.id);
    const badgeId = parsePositiveId(routeParams.badgeId);
    const badge = await assignUserBadge({
      targetUserId,
      badgeId,
      moderatorId: moderator.id,
    });

    return ok(badge);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: BadgeAssignmentRouteContext,
) {
  try {
    const moderator = await requireModeratorCapability();
    const routeParams = await params;
    const targetUserId = parsePositiveId(routeParams.id);
    const badgeId = parsePositiveId(routeParams.badgeId);
    const badge = await removeUserBadge({
      targetUserId,
      badgeId,
      moderatorId: moderator.id,
    });

    return ok(badge);
  } catch (error) {
    return handleRouteError(error);
  }
}
