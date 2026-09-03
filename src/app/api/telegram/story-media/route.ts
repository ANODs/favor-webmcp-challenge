import { z } from "zod";

import { assertAccountCapability } from "@/entities/user/server";
import { STORY_MEDIA_MAX_BYTES, saveStoryMedia } from "@/features/share-telegram-story/server";
import { env } from "@/shared/config/env";
import { fail, handleRouteError, ok } from "@/shared/lib/api";
import { prisma } from "@/shared/lib/prisma";
import { enforceRateLimit } from "@/shared/lib/rate-limit";
import { buildAbsoluteAppUrl, verifyTelegramInitData } from "@/shared/lib/telegram";

export const runtime = "nodejs";

const variantSchema = z.enum(["contract", "profile", "referral"]);

const isMp4 = (bytes: Uint8Array) =>
  bytes.length >= 12 && String.fromCharCode(...bytes.slice(4, 8)) === "ftyp";

export async function POST(request: Request) {
  try {
    const initData = request.headers.get("x-telegram-init-data")?.trim();
    if (!initData) return fail("Telegram Mini App authorization is required.", 401);
    if (request.headers.get("content-type")?.split(";", 1)[0] !== "video/mp4") {
      return fail("Only MP4 story media is supported.", 415);
    }

    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (contentLength > STORY_MEDIA_MAX_BYTES) {
      return fail("Story video is too large.", 413);
    }

    const variant = variantSchema.parse(request.headers.get("x-story-variant"));
    const telegramUser = verifyTelegramInitData(initData);
    const account = await prisma.user.findUnique({
      where: { telegramId: telegramUser.telegramId },
      select: { id: true },
    });
    if (!account) return fail("Favor account is required to share a story.", 403);

    await assertAccountCapability(account.id, "communication:write");
    await enforceRateLimit({
      key: `telegram:story-media:hour:${telegramUser.telegramId.toString()}`,
      limit: 8,
      windowMs: 60 * 60 * 1000,
    });

    const bytes = new Uint8Array(await request.arrayBuffer());
    if (!bytes.length || bytes.length > STORY_MEDIA_MAX_BYTES || !isMp4(bytes)) {
      return fail("The generated story video is invalid.", 400);
    }

    const media = await saveStoryMedia(bytes);
    const url = buildAbsoluteAppUrl(
      env.baseUrl,
      `/api/telegram/story-media/${media.token}`,
    );
    return ok({ url, expiresAt: media.expiresAt, variant });
  } catch (error) {
    console.error("[api/telegram/story-media] failed", error);
    return handleRouteError(error);
  }
}
