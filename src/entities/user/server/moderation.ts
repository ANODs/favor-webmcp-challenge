import {
  AccountRestrictionSource,
  AccountRestrictionScope,
  ContractStatus,
  Prisma,
} from "@prisma/client";

import { prisma } from "@/shared/lib/prisma";

import {
  MODERATED_USERS_PAGE_SIZE,
  paginateModeratedUsers,
} from "../model/moderation-pagination";
import { activeRestrictionWhere } from "./account-access";
import {
  toUserBadgeDto,
  userBadgeDefinitionSelect,
} from "./user-badges";

export type CreateAccountRestrictionInput = {
  targetUserId: number;
  moderatorId: number;
  scope: AccountRestrictionScope;
  reasonCode: string;
  publicMessage: string;
  internalComment?: string | null;
  expiresAt?: Date | null;
};

export async function listUsersForModeration(
  query: string,
  cursor?: { id: number; createdAt: Date },
) {
  const normalizedQuery = query.trim();
  const numericQuery = /^\d+$/.test(normalizedQuery) ? BigInt(normalizedQuery) : null;
  const numericUserId = numericQuery && numericQuery <= 2_147_483_647n
    ? Number(numericQuery)
    : null;

  const searchWhere: Prisma.UserWhereInput | undefined = normalizedQuery
    ? {
          OR: [
            ...(numericQuery
              ? [
                  ...(numericUserId ? [{ id: numericUserId }] : []),
                  { telegramId: numericQuery },
                ] satisfies Prisma.UserWhereInput[]
              : []),
            { telegramUsername: { contains: normalizedQuery, mode: "insensitive" } },
            { name: { contains: normalizedQuery, mode: "insensitive" } },
          ],
        }
    : undefined;
  const cursorWhere: Prisma.UserWhereInput | undefined = cursor
    ? {
        OR: [
          { createdAt: { lt: cursor.createdAt } },
          { createdAt: cursor.createdAt, id: { lt: cursor.id } },
        ],
      }
    : undefined;
  const records = await prisma.user.findMany({
    where: cursorWhere
      ? searchWhere
        ? { AND: [searchWhere, cursorWhere] }
        : cursorWhere
      : searchWhere,
    select: {
      id: true,
      role: true,
      telegramId: true,
      telegramUsername: true,
      isTelegramUsernameHidden: true,
      name: true,
      isPremium: true,
      telegramPremium: true,
      telegramLevel: true,
      createdAt: true,
      badgeAssignments: {
        orderBy: [
          { badge: { sortOrder: "asc" } },
          { badgeId: "asc" },
        ],
        select: {
          badge: {
            select: userBadgeDefinitionSelect,
          },
        },
      },
      accountRestrictions: {
        where: activeRestrictionWhere(),
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          scope: true,
          reasonCode: true,
          publicMessage: true,
          internalComment: true,
          source: true,
          expiresAt: true,
          createdAt: true,
          createdByModerator: {
            select: { id: true, name: true, telegramUsername: true },
          },
        },
      },
      _count: {
        select: {
          contracts: true,
          customerDeals: true,
          freelancerDeals: true,
          supportTickets: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: MODERATED_USERS_PAGE_SIZE + 1,
  });

  const page = paginateModeratedUsers(records);

  return {
    ...page,
    items: page.items.map(({ badgeAssignments, ...user }) => ({
      ...user,
      badges: badgeAssignments.map(({ badge }) => toUserBadgeDto(badge)),
    })),
  };
}

export async function createAccountRestriction(input: CreateAccountRestrictionInput) {
  if (input.targetUserId === input.moderatorId) {
    throw new Error("CANNOT_RESTRICT_OWN_ACCOUNT");
  }

  return prisma.$transaction(async (tx) => {
    const target = await tx.user.findUnique({
      where: { id: input.targetUserId },
      select: { id: true, role: true },
    });

    if (!target) {
      throw new Error("NOT_FOUND");
    }

    const duplicate = await tx.accountRestriction.findFirst({
      where: {
        userId: input.targetUserId,
        scope: input.scope,
        ...activeRestrictionWhere(),
      },
      select: { id: true },
    });

    if (duplicate) {
      throw new Error("ACCOUNT_RESTRICTION_ALREADY_ACTIVE");
    }

    const restriction = await tx.accountRestriction.create({
      data: {
        userId: input.targetUserId,
        scope: input.scope,
        reasonCode: input.reasonCode,
        publicMessage: input.publicMessage,
        internalComment: input.internalComment?.trim() || null,
        source: AccountRestrictionSource.manual,
        createdByModeratorId: input.moderatorId,
        expiresAt: input.expiresAt ?? null,
      },
    });

    await tx.accountModerationEvent.create({
      data: {
        targetUserId: input.targetUserId,
        actorUserId: input.moderatorId,
        restrictionId: restriction.id,
        action: "restriction_created",
        metadata: {
          scope: input.scope,
          reasonCode: input.reasonCode,
          expiresAt: input.expiresAt?.toISOString() ?? null,
          targetRole: target.role,
        },
      },
    });

    if (
      input.scope === AccountRestrictionScope.all_writes ||
      input.scope === AccountRestrictionScope.contract_publish
    ) {
      await tx.contract.updateMany({
        where: {
          authorId: input.targetUserId,
          status: { in: [ContractStatus.pending_moderation, ContractStatus.active] },
        },
        data: {
          status: ContractStatus.archived,
          moderationComment: "ACCOUNT_RESTRICTION_ARCHIVED",
        },
      });
    }

    return restriction;
  });
}

export async function revokeAccountRestriction(input: {
  restrictionId: number;
  targetUserId: number;
  moderatorId: number;
  comment: string;
}) {
  return prisma.$transaction(async (tx) => {
    const restriction = await tx.accountRestriction.findFirst({
      where: {
        id: input.restrictionId,
        userId: input.targetUserId,
        revokedAt: null,
      },
    });

    if (!restriction) {
      throw new Error("ACTIVE_ACCOUNT_RESTRICTION_NOT_FOUND");
    }

    const revokedAt = new Date();
    const updated = await tx.accountRestriction.update({
      where: { id: restriction.id },
      data: {
        revokedAt,
        revokedByModeratorId: input.moderatorId,
        revokeComment: input.comment.trim(),
      },
    });

    await tx.accountModerationEvent.create({
      data: {
        targetUserId: input.targetUserId,
        actorUserId: input.moderatorId,
        restrictionId: restriction.id,
        action: "restriction_revoked",
        metadata: {
          scope: restriction.scope,
          comment: input.comment.trim(),
          revokedAt: revokedAt.toISOString(),
        },
      },
    });

    return updated;
  });
}

export const accountRestrictionScopes = Object.values(AccountRestrictionScope);
