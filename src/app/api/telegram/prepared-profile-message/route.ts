import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { DealStatus, Prisma } from "@prisma/client";
import { z } from "zod";

import {
  buildProfileRichMessageHtml,
  formatProfilePreparedDescription,
  getProfileShareCopy,
} from "@/entities/user";
import { assertAccountCapability } from "@/entities/user/server";
import { env } from "@/shared/config/env";
import { fail, handleRouteError, ok } from "@/shared/lib/api";
import { withComputedPremium } from "@/shared/lib/auth";
import { prisma } from "@/shared/lib/prisma";
import { enforceRateLimit } from "@/shared/lib/rate-limit";
import { getUserProfileSlug, parseUserProfileSlug } from "@/shared/lib/profile";
import {
  buildProfileStartParam,
  buildTelegramMiniAppUrl,
  savePreparedInlineMessage,
  verifyTelegramInitData,
} from "@/shared/lib/telegram";
import { getTelegramAvatarFileId } from "@/shared/lib/telegram/avatar.server";
import { getOrUploadTelegramRichPhoto } from "@/shared/lib/telegram/rich-media.server";
import { resolveTelegramMessageLocale } from "@/shared/lib/telegram/locale.server";

const payloadSchema = z.object({
  slug: z.string().trim().min(1).max(200),
  locale: z.enum(["ru", "en"]).default("ru"),
});
const PROFILE_AVATAR_MEDIA_ID = "profile_avatar";
const PROFILE_FALLBACK_IMAGE = "favor-telegram-avatar-chrome-clean.png";

const profileUserSelect = {
  id: true,
  telegramId: true,
  telegramUsername: true,
  telegramFirstName: true,
  telegramLastName: true,
  telegramPremium: true,
  telegramLevel: true,
  isTelegramUsernameHidden: true,
  isPremium: true,
  premiumExpiresAt: true,
  name: true,
  rating: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

async function resolveProfileAvatarFileId(telegramId: bigint) {
  try {
    const avatarFileId = await getTelegramAvatarFileId(telegramId.toString());

    if (avatarFileId) {
      return avatarFileId;
    }
  } catch (error) {
    console.warn("[prepared-profile-message] Telegram avatar unavailable", {
      telegramId: telegramId.toString(),
      error,
    });
  }

  try {
    const bytes = await readFile(join(process.cwd(), "public", "images", PROFILE_FALLBACK_IMAGE));

    return await getOrUploadTelegramRichPhoto({
      cacheKey: `profile-fallback:${PROFILE_FALLBACK_IMAGE}`,
      bytes,
      contentType: "image/png",
      fileName: PROFILE_FALLBACK_IMAGE,
    });
  } catch (error) {
    console.warn("[prepared-profile-message] fallback image unavailable", error);
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
    if (requestingAccount) {
      await assertAccountCapability(requestingAccount.id, "communication:write");
    }
    await enforceRateLimit({
      key: `telegram:prepared-message:hour:${telegramUser.telegramId.toString()}`,
      limit: 10,
      windowMs: 60 * 60 * 1000,
    });
    const payload = payloadSchema.parse(await request.json());
    const locale = await resolveTelegramMessageLocale({
      telegramId: telegramUser.telegramId,
      telegramLanguageCode: telegramUser.languageCode,
      fallbackLocale: payload.locale,
    });
    const copy = getProfileShareCopy(locale);
    const parsedSlug = parseUserProfileSlug(payload.slug);
    const user = parsedSlug.id
      ? await prisma.user.findUnique({
          where: { id: parsedSlug.id },
          select: profileUserSelect,
        })
      : await prisma.user.findFirst({
          where: {
            telegramUsername: {
              equals: parsedSlug.telegramUsername ?? undefined,
              mode: "insensitive",
            },
          },
          select: profileUserSelect,
        });

    if (!user) {
      return fail(copy.preparedUnavailable, 404);
    }

    const [[contractsCount, completedDealsCount, reviewsCount, portfolioCasesCount], avatarFileId] =
      await Promise.all([
        prisma.$transaction([
          prisma.contract.count({ where: { authorId: user.id } }),
          prisma.deal.count({
            where: {
              status: DealStatus.completed,
              OR: [{ customerId: user.id }, { freelancerId: user.id }],
            },
          }),
          prisma.review.count({
            where: {
              reviewedUserId: user.id,
              deal: { status: DealStatus.completed },
            },
          }),
          prisma.portfolioCase.count({ where: { userId: user.id } }),
        ]),
        resolveProfileAvatarFileId(user.telegramId),
      ]);
    const computedUser = withComputedPremium(user);
    const fallbackName = copy.preparedFallbackName;
    const displayName =
      user.name ||
      [user.telegramFirstName, user.telegramLastName].filter(Boolean).join(" ").trim() ||
      user.telegramUsername ||
      fallbackName;
    const profileSlug = getUserProfileSlug(user);
    const miniAppUrl = buildTelegramMiniAppUrl(
      env.telegramBotUsername,
      buildProfileStartParam(profileSlug, telegramUser.telegramId),
    );
    const richMessageHtml = buildProfileRichMessageHtml(
      {
        displayName,
        telegramUsername: user.isTelegramUsernameHidden ? null : user.telegramUsername,
        rating: user.rating,
        completedDealsCount,
        contractsCount,
        reviewsCount,
        portfolioCasesCount,
        isFavorPremium: computedUser.isPremium,
        isTelegramPremium: user.telegramPremium,
        telegramLevel: user.telegramLevel,
        createdAt: user.createdAt,
        miniAppUrl,
        avatarMediaId: avatarFileId ? PROFILE_AVATAR_MEDIA_ID : null,
      },
      locale,
    );
    const preparedMessage = await savePreparedInlineMessage({
      telegramUserId: telegramUser.telegramId,
      result: {
        type: "article",
        id: `profile-${user.id}`,
        title: displayName,
        description: formatProfilePreparedDescription(
          locale,
          completedDealsCount,
          contractsCount,
        ),
        input_message_content: {
          rich_message: {
            html: richMessageHtml,
            media: avatarFileId
              ? [
                  {
                    id: PROFILE_AVATAR_MEDIA_ID,
                    media: {
                      type: "photo",
                      media: avatarFileId,
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
    console.error("[api/telegram/prepared-profile-message] failed", error);
    return handleRouteError(error);
  }
}
