import { assertAccountCapability } from "@/entities/user/server";
import { getReferralPlatformStats } from "@/features/share-referral/server";
import { fail, handleRouteError, ok } from "@/shared/lib/api";
import { prisma } from "@/shared/lib/prisma";
import { enforceRateLimit } from "@/shared/lib/rate-limit";
import { verifyTelegramInitData } from "@/shared/lib/telegram";

export async function GET(request: Request) {
  try {
    const initData = request.headers.get("x-telegram-init-data")?.trim();

    if (!initData) {
      return fail("Telegram Mini App authorization is required.", 401);
    }

    const telegramUser = verifyTelegramInitData(initData);
    const requestingAccount = await prisma.user.findUnique({
      where: { telegramId: telegramUser.telegramId },
      select: { id: true },
    });

    if (!requestingAccount) {
      return fail("Favor account is required to share a referral story.", 403);
    }

    await Promise.all([
      assertAccountCapability(requestingAccount.id, "communication:write"),
      enforceRateLimit({
        key: `telegram:referral-story-context:hour:${telegramUser.telegramId.toString()}`,
        limit: 30,
        windowMs: 60 * 60 * 1000,
      }),
    ]);

    return ok(await getReferralPlatformStats());
  } catch (error) {
    console.error("[api/telegram/referral-story-context] failed", error);
    return handleRouteError(error);
  }
}
