import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { z } from "zod";

import { assertAccountCapability } from "@/entities/user/server";
import { CONTRACT_REFERRAL_REWARD_SHARE_PERCENT } from "@/features/contract-referrals";
import {
  buildReferralRichMessageHtml,
  formatReferralPreparedDescription,
  getReferralShareCopy,
  getReferralShareIntlLocale,
  type ReferralShareLocale,
} from "@/features/share-referral";
import { getReferralPlatformStats } from "@/features/share-referral/server";
import { env } from "@/shared/config/env";
import { fail, handleRouteError, ok } from "@/shared/lib/api";
import { prisma } from "@/shared/lib/prisma";
import { enforceRateLimit } from "@/shared/lib/rate-limit";
import {
  buildReferralStartParam,
  buildTelegramMiniAppUrl,
  savePreparedInlineMessage,
  verifyTelegramInitData,
} from "@/shared/lib/telegram";
import { getOrUploadTelegramRichPhoto } from "@/shared/lib/telegram/rich-media.server";

const payloadSchema = z.object({
  locale: z.enum(["ru", "en"]).default("ru"),
});
const REFERRAL_IMAGE_MEDIA_ID = "favor_referral";

async function resolveReferralImageFileId(locale: ReferralShareLocale) {
  const fileName = `og-${locale}.png`;

  try {
    const bytes = await readFile(join(process.cwd(), "public", "images", fileName));

    return await getOrUploadTelegramRichPhoto({
      cacheKey: `referral-share:${fileName}`,
      bytes,
      contentType: "image/png",
      fileName,
    });
  } catch (error) {
    console.warn("[prepared-referral-message] image unavailable", { fileName, error });
    return null;
  }
}

export async function POST(request: Request) {
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
      return fail("Favor account is required to share a referral link.", 403);
    }

    await assertAccountCapability(requestingAccount.id, "communication:write");
    await enforceRateLimit({
      key: `telegram:prepared-message:hour:${telegramUser.telegramId.toString()}`,
      limit: 10,
      windowMs: 60 * 60 * 1000,
    });

    const payload = payloadSchema.parse(await request.json());
    const locale = payload.locale;
    const copy = getReferralShareCopy(locale);
    const [stats, imageFileId] = await Promise.all([
      getReferralPlatformStats(),
      resolveReferralImageFileId(locale),
    ]);
    const { usersCount, activeContractsCount } = stats;
    const referralUrl = buildTelegramMiniAppUrl(
      env.telegramBotUsername,
      buildReferralStartParam(telegramUser.telegramId),
    );
    const richMessageHtml = buildReferralRichMessageHtml(
      {
        stats,
        rewardSharePercent: CONTRACT_REFERRAL_REWARD_SHARE_PERCENT,
        referralUrl,
        imageMediaId: imageFileId ? REFERRAL_IMAGE_MEDIA_ID : null,
      },
      locale,
    );
    const numberLocale = getReferralShareIntlLocale(locale);
    const preparedMessage = await savePreparedInlineMessage({
      telegramUserId: telegramUser.telegramId,
      result: {
        type: "article",
        id: `referral-${requestingAccount.id}`,
        title: copy.title,
        description: formatReferralPreparedDescription(
          locale,
          usersCount.toLocaleString(numberLocale),
          activeContractsCount.toLocaleString(numberLocale),
        ),
        input_message_content: {
          rich_message: {
            html: richMessageHtml,
            media: imageFileId
              ? [
                  {
                    id: REFERRAL_IMAGE_MEDIA_ID,
                    media: {
                      type: "photo",
                      media: imageFileId,
                    },
                  },
                ]
              : undefined,
          },
        },
      },
    });

    return ok({
      id: preparedMessage.id,
      expirationDate: preparedMessage.expiration_date,
    });
  } catch (error) {
    console.error("[api/telegram/prepared-referral-message] failed", error);
    return handleRouteError(error);
  }
}
