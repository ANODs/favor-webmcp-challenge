import {
  AccountRestrictionScope,
  type AccountRestriction,
  type Prisma,
} from "@prisma/client";

import { ApplicationError } from "@/shared/lib/application-error";
import { requireModerator, requireUser } from "@/shared/lib/auth";
import { prisma } from "@/shared/lib/prisma";
import { verifyTelegramInitData } from "@/shared/lib/telegram";

export type AccountCapability =
  | "authenticate"
  | "account:write"
  | "contract:publish"
  | "deal:create"
  | "communication:write"
  | "support:submit"
  | "moderation:write";

const blockingScopesByCapability: Record<AccountCapability, AccountRestrictionScope[]> = {
  authenticate: [AccountRestrictionScope.login_lock],
  "account:write": [
    AccountRestrictionScope.login_lock,
    AccountRestrictionScope.all_writes,
  ],
  "contract:publish": [
    AccountRestrictionScope.login_lock,
    AccountRestrictionScope.all_writes,
    AccountRestrictionScope.contract_publish,
  ],
  "deal:create": [
    AccountRestrictionScope.login_lock,
    AccountRestrictionScope.all_writes,
    AccountRestrictionScope.deal_create,
  ],
  "communication:write": [
    AccountRestrictionScope.login_lock,
    AccountRestrictionScope.all_writes,
    AccountRestrictionScope.communication,
  ],
  "support:submit": [
    AccountRestrictionScope.login_lock,
    AccountRestrictionScope.support,
  ],
  "moderation:write": [
    AccountRestrictionScope.login_lock,
    AccountRestrictionScope.all_writes,
  ],
};

export const isAccountRestrictionBlocking = (
  scope: AccountRestrictionScope,
  capability: AccountCapability,
) => blockingScopesByCapability[capability].includes(scope);

export const activeRestrictionWhere = (now = new Date()) =>
  ({
    revokedAt: null,
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
  }) satisfies Prisma.AccountRestrictionWhereInput;

export const getActiveAccountRestrictions = (userId: number, now = new Date()) =>
  prisma.accountRestriction.findMany({
    where: {
      userId,
      ...activeRestrictionWhere(now),
    },
    orderBy: { createdAt: "desc" },
  });

const toRestrictionDetails = (restriction: AccountRestriction) => ({
  restrictionId: restriction.id,
  scope: restriction.scope,
  reasonCode: restriction.reasonCode,
  expiresAt: restriction.expiresAt,
});

export async function assertAccountCapability(
  userId: number,
  capability: AccountCapability,
) {
  if (userId === 0) {
    return;
  }

  const restriction = await prisma.accountRestriction.findFirst({
    where: {
      userId,
      scope: { in: blockingScopesByCapability[capability] },
      ...activeRestrictionWhere(),
    },
    orderBy: { createdAt: "desc" },
  });

  if (!restriction) {
    return;
  }

  throw new ApplicationError(
    "ACCOUNT_RESTRICTED",
    restriction.publicMessage,
    403,
    toRestrictionDetails(restriction),
  );
}

export async function requireUserCapability(capability: AccountCapability) {
  const user = await requireUser();
  await assertAccountCapability(user.id, capability);
  return user;
}

export async function requireTelegramUser(request: Request) {
  const initData = request.headers.get("x-telegram-init-data")?.trim();

  if (!initData) {
    throw new ApplicationError(
      "TELEGRAM_CONTEXT_REQUIRED",
      "Telegram Mini App context is required.",
      403,
    );
  }

  let telegramUser: ReturnType<typeof verifyTelegramInitData>;

  try {
    telegramUser = verifyTelegramInitData(initData);
  } catch {
    throw new ApplicationError(
      "TELEGRAM_CONTEXT_INVALID",
      "The Telegram Mini App session is invalid.",
      403,
    );
  }

  const user = await requireUser();

  if (user.telegramId !== telegramUser.telegramId) {
    throw new ApplicationError(
      "TELEGRAM_CONTEXT_MISMATCH",
      "The Telegram Mini App session does not match the authenticated account.",
      403,
    );
  }

  return user;
}

export async function requireTelegramUserCapability(
  request: Request,
  capability: AccountCapability,
) {
  const user = await requireTelegramUser(request);
  await assertAccountCapability(user.id, capability);
  return user;
}

export async function requireModeratorCapability() {
  const user = await requireModerator();
  await assertAccountCapability(user.id, "moderation:write");
  return user;
}

export const canAccountPerform = async (
  userId: number,
  capability: AccountCapability,
) => {
  try {
    await assertAccountCapability(userId, capability);
    return true;
  } catch (error) {
    if (error instanceof ApplicationError && error.code === "ACCOUNT_RESTRICTED") {
      return false;
    }

    throw error;
  }
};
