import { enforceRateLimit } from "@/shared/lib/rate-limit";
import { fail, handleRouteError, ok } from "@/shared/lib/api";
import { prisma } from "@/shared/lib/prisma";
import { verifyTelegramInitData } from "@/shared/lib/telegram";
import { saveClientDiagnosticReport } from "@/features/report-problem/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const initData = request.headers.get("x-telegram-init-data")?.trim();
    if (!initData) return fail("Telegram Mini App authorization is required.", 401);

    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (contentLength > 32 * 1024) return fail("Diagnostic report is too large.", 413);

    const telegramUser = verifyTelegramInitData(initData);
    const account = await prisma.user.findUnique({
      where: { telegramId: telegramUser.telegramId },
      select: { id: true },
    });
    if (!account) return fail("Favor account is required to send diagnostics.", 403);

    await Promise.all([
      enforceRateLimit({
        key: `telegram:client-error-report:hour:${telegramUser.telegramId.toString()}`,
        limit: 12,
        windowMs: 60 * 60 * 1000,
      }),
      enforceRateLimit({
        key: `telegram:client-error-report:day:${telegramUser.telegramId.toString()}`,
        limit: 40,
        windowMs: 24 * 60 * 60 * 1000,
      }),
    ]);

    const report = await request.json();
    return ok(
      await saveClientDiagnosticReport({
        userId: account.id,
        reporterTelegramId: telegramUser.telegramId,
        report,
      }),
    );
  } catch (error) {
    console.error("[api/telegram/client-error-reports] failed", error);
    return handleRouteError(error);
  }
}
