import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { Prisma, Role } from "@prisma/client";

import { env } from "@/shared/config/env";
import { CURRENT_ONBOARDING_VERSION } from "@/shared/lib/onboarding";
import { isDatabaseUnavailableError } from "@/shared/lib/prisma-errors";
import { prisma } from "@/shared/lib/prisma";
import { verifyTelegramInitData } from "@/shared/lib/telegram/auth";
import {
  type AuthSessionSubject,
  clearAuthSessionCookies,
  setAuthSessionCookies,
  setStoredAuthSessionCookies,
  verifyDevAuthToken,
  verifyAuthRefreshToken,
  verifyLegacyAuthToken,
  verifyStoredAuthToken,
} from "@/shared/lib/auth-session";
import {
  getAuthSessionAccessCookieName,
  getAuthSessionRefreshCookieName,
  readActiveAuthSessionId,
} from "@/shared/lib/auth-session-cookie";
import {
  createStoredAuthSession,
  rotateStoredAuthSession,
} from "@/shared/lib/auth-session-store";

export {
  clearAuthSessionCookies,
  signAuthRefreshToken,
  signAuthToken,
  verifyDevAuthToken,
  verifyAuthRefreshToken,
  verifyLegacyAuthToken,
  verifyStoredAuthToken,
} from "@/shared/lib/auth-session";
export type { AuthSessionSubject } from "@/shared/lib/auth-session";

export const isModeratorTelegramId = (telegramId: bigint) =>
  env.moderatorTelegramIds.includes(telegramId.toString());

export const resolveRoleByTelegramId = (telegramId: bigint) =>
  isModeratorTelegramId(telegramId) ? Role.moderator : Role.customer;

const currentUserSelect = {
  id: true,
  role: true,
  telegramId: true,
  telegramUsername: true,
  telegramFirstName: true,
  telegramLastName: true,
  telegramPremium: true,
  telegramLevel: true,
  isPremium: true,
  premiumExpiresAt: true,
  onboardingVersion: true,
  adBalance: true,
  name: true,
  rating: true,
  isTelegramUsernameHidden: true,
  walletAddress: true,
} satisfies Prisma.UserSelect;

type CurrentUser = Prisma.UserGetPayload<{
  select: typeof currentUserSelect;
}>;

export const withComputedPremium = <T extends { isPremium: boolean; premiumExpiresAt: Date | null }>(user: T): T => {
  if (user.premiumExpiresAt && user.premiumExpiresAt > new Date()) {
    return { ...user, isPremium: true };
  }

  if (user.premiumExpiresAt && user.premiumExpiresAt <= new Date()) {
    return { ...user, isPremium: false };
  }

  return user;
};

const buildLegacyPremiumExpiration = () => {
  const expiration = new Date();
  expiration.setMonth(expiration.getMonth() + 1);
  return expiration;
};

const ensurePremiumExpiration = async <T extends { id: number; isPremium: boolean; premiumExpiresAt: Date | null }>(
  user: T,
): Promise<T> => {
  if (user.id === 0 || !user.isPremium || user.premiumExpiresAt) {
    return user;
  }

  const premiumExpiresAt = buildLegacyPremiumExpiration();

  await prisma.user.update({
    where: { id: user.id },
    data: { premiumExpiresAt },
    select: { id: true },
  });

  return { ...user, premiumExpiresAt };
};

const buildDevSessionUser = (): CurrentUser => ({
  id: 0,
  role: env.devSession.role,
  telegramId: env.devSession.telegramId,
  telegramUsername: env.devSession.username,
  telegramFirstName: env.devSession.name,
  telegramLastName: null,
  telegramPremium: false,
  telegramLevel: null,
  isPremium: false,
  premiumExpiresAt: null,
  onboardingVersion: CURRENT_ONBOARDING_VERSION,
  isTelegramUsernameHidden: false,
  adBalance: 0,
  name: env.devSession.name,
  rating: 5,
  walletAddress: null,
});

export const getOrCreateDevSessionUser = async () => {
  if (!env.enableDevSessionAuth) {
    return null;
  }

  try {
    const user = await prisma.user.upsert({
      where: {
        telegramId: env.devSession.telegramId,
      },
      update: {
        role: env.devSession.role,
        primaryAuthProvider: "telegram",
        telegramUsername: env.devSession.username,
        telegramFirstName: env.devSession.name,
        telegramIsVerified: true,
        telegramPremium: false,
        telegramLevel: null,
        name: env.devSession.name,
      },
      create: {
        role: env.devSession.role,
        primaryAuthProvider: "telegram",
        telegramId: env.devSession.telegramId,
        telegramUsername: env.devSession.username,
        telegramFirstName: env.devSession.name,
        telegramIsVerified: true,
        telegramPremium: false,
        telegramLevel: null,
        name: env.devSession.name,
      },
      select: currentUserSelect,
    });
    return withComputedPremium(await ensurePremiumExpiration(user));
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return buildDevSessionUser();
    }

    throw error;
  }
};

export const getCurrentUser = async () => {
  const cookieStore = await cookies();
  const activeSessionId = readActiveAuthSessionId(cookieStore);
  const token = activeSessionId
    ? cookieStore.get(getAuthSessionAccessCookieName(activeSessionId))?.value
    : cookieStore.get(env.authCookieName)?.value;

  if (!token) {
    return getOrCreateDevSessionUser();
  }

  let payload: AuthSessionSubject;
  try {
    if (activeSessionId) {
      payload = verifyStoredAuthToken(token, activeSessionId);
    } else {
      try {
        payload = verifyLegacyAuthToken(token);
      } catch (legacyError) {
        if (!env.enableDevSessionAuth) throw legacyError;

        const devPayload = verifyDevAuthToken(token);
        if (devPayload.telegramId !== env.devSession.telegramId.toString()) {
          throw new Error("Unexpected development authentication identity.");
        }
        payload = devPayload;
      }
    }
  } catch {
    return getOrCreateDevSessionUser();
  }

  if (
    env.enableDevSessionAuth &&
    payload.telegramId === env.devSession.telegramId.toString() &&
    payload.userId === 0
  ) {
    return buildDevSessionUser();
  }

  try {
    if (activeSessionId) {
      const session = await prisma.authSession.findFirst({
        where: {
          id: activeSessionId,
          userId: payload.userId,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        select: { user: { select: currentUserSelect } },
      });
      const user = session?.user;

      if (!user || user.telegramId.toString() !== payload.telegramId) {
        return null;
      }

      return withComputedPremium(await ensurePremiumExpiration(user));
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: currentUserSelect,
    });

    if (
      !user &&
      env.enableDevSessionAuth &&
      payload.telegramId === env.devSession.telegramId.toString()
    ) {
      return buildDevSessionUser();
    }

    return user ? withComputedPremium(await ensurePremiumExpiration(user)) : null;
  } catch (error) {
    if (
      isDatabaseUnavailableError(error) &&
      env.enableDevSessionAuth &&
      payload.telegramId === env.devSession.telegramId.toString()
    ) {
      return buildDevSessionUser();
    }

    throw error;
  }
};

export const startAuthSession = async (
  response: NextResponse,
  payload: AuthSessionSubject,
) => {
  if (
    env.enableDevSessionAuth &&
    payload.userId === 0 &&
    payload.telegramId === env.devSession.telegramId.toString()
  ) {
    return setAuthSessionCookies(response, payload);
  }

  try {
    const cookieStore = await cookies();
    const replacedSessionId = readActiveAuthSessionId(cookieStore);
    let replacedAccessTokenVerified = false;
    const replacedRefreshToken = replacedSessionId
      ? cookieStore.get(
          getAuthSessionRefreshCookieName(replacedSessionId),
        )?.value
      : undefined;

    if (replacedSessionId) {
      const replacedAccessToken = cookieStore.get(
        getAuthSessionAccessCookieName(replacedSessionId),
      )?.value;
      if (replacedAccessToken) {
        try {
          verifyStoredAuthToken(replacedAccessToken, replacedSessionId);
          replacedAccessTokenVerified = true;
        } catch {
          replacedAccessTokenVerified = false;
        }
      }
    }

    const issue = await createStoredAuthSession(payload.userId, new Date(), {
      replacementProof:
        replacedSessionId &&
        (replacedAccessTokenVerified || replacedRefreshToken)
          ? {
              sessionId: replacedSessionId,
              accessTokenVerified: replacedAccessTokenVerified,
              refreshToken: replacedRefreshToken,
            }
          : undefined,
    });
    return setStoredAuthSessionCookies(response, payload, issue, {
      activateSession: true,
      replacedSessionId,
    });
  } catch (error) {
    if (
      isDatabaseUnavailableError(error) &&
      env.enableDevSessionAuth &&
      payload.telegramId === env.devSession.telegramId.toString()
    ) {
      return setAuthSessionCookies(response, payload);
    }

    throw error;
  }
};

const resolveRefreshSessionSubjectByUserId = async (
  userId: number,
): Promise<AuthSessionSubject | null> => {
  if (userId === 0 && env.enableDevSessionAuth) {
    const user = await getOrCreateDevSessionUser();
    return user
      ? {
          userId: user.id,
          role: user.role,
          telegramId: user.telegramId.toString(),
        }
      : null;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, telegramId: true },
  });

  return user
    ? {
        userId: user.id,
        role: user.role,
        telegramId: user.telegramId.toString(),
      }
    : null;
};

const resolveRefreshSessionSubject = async (
  payload: AuthSessionSubject,
): Promise<AuthSessionSubject | null> => {
  const session = await resolveRefreshSessionSubjectByUserId(payload.userId);
  return session?.telegramId === payload.telegramId ? session : null;
};

export const getRefreshableAuthSession = async () => {
  const cookieStore = await cookies();
  const activeSessionId = readActiveAuthSessionId(cookieStore);

  if (activeSessionId) {
    const refreshToken = cookieStore.get(
      getAuthSessionRefreshCookieName(activeSessionId),
    )?.value;
    if (!refreshToken) {
      return null;
    }

    const accessToken = cookieStore.get(
      getAuthSessionAccessCookieName(activeSessionId),
    )?.value;
    let accessPayload: AuthSessionSubject | null = null;
    if (accessToken) {
      try {
        accessPayload = verifyStoredAuthToken(accessToken, activeSessionId);
      } catch {
        accessPayload = null;
      }
    }

    const rotation = await rotateStoredAuthSession(
      activeSessionId,
      refreshToken,
      new Date(),
      accessPayload,
    );
    if (rotation.status !== "rotated" && rotation.status !== "grace") {
      return null;
    }

    return {
      storage: "database" as const,
      session: rotation.session,
      recoveredAccess: !accessPayload,
      cookieIssue: rotation,
    };
  }

  const refreshToken = cookieStore.get(env.authRefreshCookieName)?.value;
  const accessToken = cookieStore.get(env.authCookieName)?.value;

  let refreshPayload: ReturnType<typeof verifyAuthRefreshToken> | null = null;
  let accessPayload: AuthSessionSubject | null = null;
  let legacyAccessPayload: AuthSessionSubject | null = null;

  if (refreshToken && env.enableDevSessionAuth) {
    try {
      refreshPayload = verifyAuthRefreshToken(refreshToken);
    } catch {
      refreshPayload = null;
    }
  }

  if (accessToken) {
    try {
      accessPayload = verifyDevAuthToken(accessToken);
    } catch {
      try {
        legacyAccessPayload = verifyLegacyAuthToken(accessToken);
        accessPayload = legacyAccessPayload;
      } catch {
        accessPayload = null;
      }
    }
  }

  if (!refreshPayload && legacyAccessPayload) {
    const session = await resolveRefreshSessionSubject(legacyAccessPayload);
    return session
      ? {
          storage: "legacy" as const,
          session,
          recoveredAccess: false,
        }
      : null;
  }

  if (
    refreshPayload &&
    accessPayload &&
    (refreshPayload.userId !== accessPayload.userId ||
      refreshPayload.telegramId !== accessPayload.telegramId)
  ) {
    return null;
  }

  const payload = refreshPayload;
  if (!payload) {
    return null;
  }

  const session = await resolveRefreshSessionSubject(payload);
  return session
    ? {
        storage: "stateless" as const,
        session,
        recoveredAccess: Boolean(refreshPayload && !accessPayload),
        refreshSessionStartedAt: refreshPayload?.sessionStartedAt,
      }
    : null;
};

type RefreshableAuthSession = NonNullable<
  Awaited<ReturnType<typeof getRefreshableAuthSession>>
>;

export const setRefreshedAuthSessionCookies = (
  response: NextResponse,
  refreshableSession: RefreshableAuthSession,
) => {
  if (refreshableSession.storage === "database") {
    return setStoredAuthSessionCookies(
      response,
      refreshableSession.session,
      refreshableSession.cookieIssue,
      { activateSession: false },
    );
  }

  if (refreshableSession.storage === "stateless") {
    return setAuthSessionCookies(response, refreshableSession.session, {
      refreshSessionStartedAt: refreshableSession.refreshSessionStartedAt,
    });
  }

  return response;
};

export const clearFailedAuthSessionRefreshCookies = async (
  response: NextResponse,
) => {
  const cookieStore = await cookies();
  return clearAuthSessionCookies(response, {
    sessionId: readActiveAuthSessionId(cookieStore),
    // A late response for session A must never clear the active pointer for a
    // newer login B. Session-specific cookie names make that race harmless.
    clearActiveSession: false,
  });
};

export const syncCurrentUserFromTelegramInitData = async (
  user: CurrentUser | null,
  initData: string | null | undefined,
) => {
  if (!user || !initData || user.id === 0) {
    return user;
  }

  try {
    const telegramUser = verifyTelegramInitData(initData);

    if (telegramUser.telegramId !== user.telegramId) {
      return user;
    }

    const fallbackName =
      [telegramUser.firstName, telegramUser.lastName].filter(Boolean).join(" ") ||
      telegramUser.username ||
      user.name;

    const hasChanges =
      user.telegramUsername !== telegramUser.username ||
      user.telegramFirstName !== telegramUser.firstName ||
      user.telegramLastName !== telegramUser.lastName ||
      user.telegramPremium !== telegramUser.telegramPremium ||
      user.telegramLevel !== telegramUser.telegramLevel ||
      user.name !== fallbackName;

    if (!hasChanges) {
      return user;
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        telegramUsername: telegramUser.username,
        telegramFirstName: telegramUser.firstName,
        telegramLastName: telegramUser.lastName,
        telegramPremium: telegramUser.telegramPremium,
        telegramLevel: telegramUser.telegramLevel,
        name: fallbackName,
      },
      select: currentUserSelect,
    });
    return withComputedPremium(await ensurePremiumExpiration(updated));
  } catch {
    return user;
  }
};

export const requireUser = async () => {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("UNAUTHORIZED");
  }

  return user;
};

export const requireModerator = async () => {
  const user = await requireUser();

  if (user.role !== Role.moderator) {
    throw new Error("FORBIDDEN");
  }

  return user;
};
