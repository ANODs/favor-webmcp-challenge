import { randomUUID } from "node:crypto";

import { Prisma } from "@prisma/client";

import type {
  CreateUserBadgePayload,
  UserBadgeDto,
} from "../api/user-badge-dto";
import {
  isUserBadgeIconKey,
  isUserBadgeTone,
  paginateUserBadgeCatalog,
  USER_BADGE_CATALOG_PAGE_SIZE,
} from "../model/user-badges";
import { prisma } from "@/shared/lib/prisma";

export const userBadgeDefinitionSelect = {
  id: true,
  code: true,
  labelRu: true,
  labelEn: true,
  descriptionRu: true,
  descriptionEn: true,
  iconKey: true,
  tone: true,
  sortOrder: true,
} satisfies Prisma.UserBadgeDefinitionSelect;

type UserBadgeDefinitionRecord = Prisma.UserBadgeDefinitionGetPayload<{
  select: typeof userBadgeDefinitionSelect;
}>;

const USER_BADGE_MODERATION_ACTIONS = {
  assigned: "badge_assigned",
  removed: "badge_removed",
} as const;

const buildUserBadgeDefinitionData = (
  input: CreateUserBadgePayload,
  moderatorId: number,
) =>
  ({
    code: randomUUID(),
    labelRu: input.labelRu.trim(),
    labelEn: input.labelEn.trim(),
    descriptionRu: input.descriptionRu.trim(),
    descriptionEn: input.descriptionEn.trim(),
    iconKey: input.iconKey,
    tone: input.tone,
    ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
    createdByModeratorId: moderatorId,
  }) satisfies Prisma.UserBadgeDefinitionUncheckedCreateInput;

export const toUserBadgeDto = (
  badge: UserBadgeDefinitionRecord,
): UserBadgeDto => ({
  id: badge.id,
  code: badge.code,
  labelRu: badge.labelRu,
  labelEn: badge.labelEn,
  descriptionRu: badge.descriptionRu,
  descriptionEn: badge.descriptionEn,
  iconKey: isUserBadgeIconKey(badge.iconKey) ? badge.iconKey : "award",
  tone: isUserBadgeTone(badge.tone) ? badge.tone : "default",
  sortOrder: badge.sortOrder,
});

export async function listUserBadgeDefinitions(
  cursor?: { sortOrder: number; id: number },
) {
  const records = await prisma.userBadgeDefinition.findMany({
    where: cursor
      ? {
          OR: [
            { sortOrder: { gt: cursor.sortOrder } },
            { sortOrder: cursor.sortOrder, id: { gt: cursor.id } },
          ],
        }
      : undefined,
    select: userBadgeDefinitionSelect,
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    take: USER_BADGE_CATALOG_PAGE_SIZE + 1,
  });
  const page = paginateUserBadgeCatalog(records);

  return {
    items: page.items.map(toUserBadgeDto),
    nextCursor: page.nextCursor,
  };
}

export async function createUserBadgeDefinition(
  input: CreateUserBadgePayload,
  moderatorId: number,
) {
  const badge = await prisma.userBadgeDefinition.create({
    data: buildUserBadgeDefinitionData(input, moderatorId),
    select: userBadgeDefinitionSelect,
  });

  return toUserBadgeDto(badge);
}

export async function createAndAssignUserBadgeDefinition(
  input: CreateUserBadgePayload,
  targetUserId: number,
  moderatorId: number,
) {
  return prisma.$transaction(async (tx) => {
    const targetUser = await tx.user.findUnique({
      where: { id: targetUserId },
      select: { id: true },
    });

    if (!targetUser) {
      throw new Error("NOT_FOUND");
    }

    const badge = await tx.userBadgeDefinition.create({
      data: buildUserBadgeDefinitionData(input, moderatorId),
      select: userBadgeDefinitionSelect,
    });

    await tx.userBadgeAssignment.create({
      data: {
        userId: targetUserId,
        badgeId: badge.id,
        assignedByModeratorId: moderatorId,
      },
    });
    await tx.accountModerationEvent.create({
      data: {
        targetUserId,
        actorUserId: moderatorId,
        action: USER_BADGE_MODERATION_ACTIONS.assigned,
        metadata: {
          badgeId: badge.id,
          badgeCode: badge.code,
        },
      },
    });

    return toUserBadgeDto(badge);
  });
}

export async function assignUserBadge(input: {
  targetUserId: number;
  badgeId: number;
  moderatorId: number;
}) {
  return prisma.$transaction(async (tx) => {
    const [targetUser, badge] = await Promise.all([
      tx.user.findUnique({
        where: { id: input.targetUserId },
        select: { id: true },
      }),
      tx.userBadgeDefinition.findUnique({
        where: { id: input.badgeId },
        select: userBadgeDefinitionSelect,
      }),
    ]);

    if (!targetUser || !badge) {
      throw new Error("NOT_FOUND");
    }

    const created = await tx.userBadgeAssignment.createMany({
      data: {
        userId: input.targetUserId,
        badgeId: input.badgeId,
        assignedByModeratorId: input.moderatorId,
      },
      skipDuplicates: true,
    });

    if (created.count > 0) {
      await tx.accountModerationEvent.create({
        data: {
          targetUserId: input.targetUserId,
          actorUserId: input.moderatorId,
          action: USER_BADGE_MODERATION_ACTIONS.assigned,
          metadata: {
            badgeId: badge.id,
            badgeCode: badge.code,
          },
        },
      });
    }

    return toUserBadgeDto(badge);
  });
}

export async function removeUserBadge(input: {
  targetUserId: number;
  badgeId: number;
  moderatorId: number;
}) {
  return prisma.$transaction(async (tx) => {
    const [targetUser, badge] = await Promise.all([
      tx.user.findUnique({
        where: { id: input.targetUserId },
        select: { id: true },
      }),
      tx.userBadgeDefinition.findUnique({
        where: { id: input.badgeId },
        select: userBadgeDefinitionSelect,
      }),
    ]);

    if (!targetUser || !badge) {
      throw new Error("NOT_FOUND");
    }

    const removed = await tx.userBadgeAssignment.deleteMany({
      where: {
        userId: input.targetUserId,
        badgeId: input.badgeId,
      },
    });

    if (removed.count > 0) {
      await tx.accountModerationEvent.create({
        data: {
          targetUserId: input.targetUserId,
          actorUserId: input.moderatorId,
          action: USER_BADGE_MODERATION_ACTIONS.removed,
          metadata: {
            badgeId: badge.id,
            badgeCode: badge.code,
          },
        },
      });
    }

    return { removed: removed.count > 0 };
  });
}
