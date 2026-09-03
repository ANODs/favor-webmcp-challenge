import { assertAccountCapability } from "@/entities/user/server";
import { env } from "@/shared/config/env";
import { ok, handleRouteError } from "@/shared/lib/api";
import {
  resolveRoleByTelegramId,
  startAuthSession,
  withComputedPremium,
} from "@/shared/lib/auth";
import { prisma } from "@/shared/lib/prisma";
import { consumeRateLimit, enforceRateLimit } from "@/shared/lib/rate-limit";
import { hashRequestIp } from "@/shared/lib/request-ip";
import {
  parseReferralTelegramId,
  telegramAuthSchema,
  verifyTelegramInitData,
} from "@/shared/lib/telegram";
import { withTelegramAvatar } from "@/shared/lib/telegram/avatar";
import { requireTurnstile } from "@/shared/lib/turnstile";

export async function POST(request: Request) {
  try {
    const ipHash = hashRequestIp(request);
    await enforceRateLimit({
      key: `auth:telegram:hard:${ipHash}`,
      limit: 30,
      windowMs: 60 * 1000,
    });
    const softLimit = await consumeRateLimit({
      key: `auth:telegram:challenge:${ipHash}`,
      limit: 5,
      windowMs: 5 * 60 * 1000,
    });
    if (!softLimit.allowed) {
      await requireTurnstile(request, "telegram_auth");
    }

    const body = telegramAuthSchema.parse(await request.json());
    console.info("[api/auth/telegram] request received", {
      hasInitData: Boolean(body.initData),
      initDataLength: body.initData.length,
    });

    const telegramUser = verifyTelegramInitData(body.initData);
    const role = resolveRoleByTelegramId(telegramUser.telegramId);
    const effectiveStartParam = telegramUser.startParam ?? body.startParam ?? null;
    const referrerTelegramId = parseReferralTelegramId(effectiveStartParam);
    const restrictedAccount = await prisma.user.findUnique({
      where: { telegramId: telegramUser.telegramId },
      select: { id: true },
    });

    if (restrictedAccount) {
      await assertAccountCapability(restrictedAccount.id, "authenticate");
    }

    console.info("[api/auth/telegram] initData verified", {
      telegramId: telegramUser.telegramId.toString(),
      username: telegramUser.username,
      role,
      startParam: effectiveStartParam,
    });
    const fallbackName =
      [telegramUser.firstName, telegramUser.lastName].filter(Boolean).join(" ") ||
      telegramUser.username ||
      "Telegram user";

    const user = await prisma.$transaction(async (tx) => {
      const existingUser = await tx.user.findUnique({
        where: {
          telegramId: telegramUser.telegramId,
        },
        select: {
          id: true,
        },
      });

      if (existingUser) {
        return tx.user.update({
          where: {
            id: existingUser.id,
          },
          data: {
            role,
            primaryAuthProvider: "telegram",
            telegramUsername: telegramUser.username,
            telegramFirstName: telegramUser.firstName,
            telegramLastName: telegramUser.lastName,
            telegramIsVerified: true,
            telegramPremium: telegramUser.telegramPremium,
            telegramLevel: telegramUser.telegramLevel,
            name: fallbackName,
          },
          select: {
            id: true,
            role: true,
            telegramId: true,
            telegramUsername: true,
            telegramFirstName: true,
            telegramLastName: true,
            telegramIsVerified: true,
            telegramPremium: true,
            telegramLevel: true,
            isPremium: true,
            premiumExpiresAt: true,
            onboardingVersion: true,
            name: true,
          },
        });
      }

      const referrer =
        referrerTelegramId && referrerTelegramId !== telegramUser.telegramId
          ? await tx.user.findUnique({
              where: {
                telegramId: referrerTelegramId,
              },
              select: {
                id: true,
              },
            })
          : null;

      return tx.user.create({
        data: {
          role,
          primaryAuthProvider: "telegram",
          telegramId: telegramUser.telegramId,
          telegramUsername: telegramUser.username,
          telegramFirstName: telegramUser.firstName,
          telegramLastName: telegramUser.lastName,
          telegramIsVerified: true,
          telegramPremium: telegramUser.telegramPremium,
          telegramLevel: telegramUser.telegramLevel,
          name: fallbackName,
          referredById: referrer?.id ?? null,
        },
        select: {
          id: true,
          role: true,
          telegramId: true,
          telegramUsername: true,
          telegramFirstName: true,
          telegramLastName: true,
          telegramIsVerified: true,
          telegramPremium: true,
          telegramLevel: true,
          isPremium: true,
          premiumExpiresAt: true,
          onboardingVersion: true,
          name: true,
        },
      });
    });

    const response = ok(withTelegramAvatar(withComputedPremium(user)));

    console.info("[api/auth/telegram] auth cookie is being set", {
      userId: user.id,
      authCookieName: env.authCookieName,
    });

    return await startAuthSession(response, {
      userId: user.id,
      role: user.role,
      telegramId: user.telegramId.toString(),
    });
  } catch (error) {
    console.error("[api/auth/telegram] failed", error);
    return handleRouteError(error);
  }
}
