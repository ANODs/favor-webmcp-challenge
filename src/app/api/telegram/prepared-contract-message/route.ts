import { ContractStatus, DealStatus } from "@prisma/client";
import { z } from "zod";

import { getCategoryLabel } from "@/entities/category";
import {
  buildContractOgImagePath,
  buildContractOgRichMediaCacheKey,
  CONTRACT_OG_COVER_STATE_HEADER,
  isContractOgCoverStatePersistable,
  resolveLocalizedContractContent,
} from "@/entities/contract";
import {
  buildContractRichMessageHtml,
} from "@/entities/contract/telegram-rich-message";
import { OPEN_DEAL_STATUSES } from "@/entities/deal";
import { assertAccountCapability } from "@/entities/user/server";
import { routes } from "@/shared/config/routes";
import { env } from "@/shared/config/env";
import { fail, handleRouteError, ok } from "@/shared/lib/api";
import { prisma } from "@/shared/lib/prisma";
import { enforceRateLimit } from "@/shared/lib/rate-limit";
import { getLocalizedPathname } from "@/shared/lib/seo";
import {
  buildAbsoluteAppUrl,
  buildContractDealIntentStartParam,
  buildTelegramMiniAppUrl,
  savePreparedInlineMessage,
  verifyTelegramInitData,
} from "@/shared/lib/telegram";
import { getOrUploadTelegramRichPhoto } from "@/shared/lib/telegram/server";

const payloadSchema = z.object({
  slug: z.string().trim().min(1).max(200),
  locale: z.enum(["ru", "en"]).default("ru"),
});
const CONTRACT_COVER_MEDIA_ID = "contract_cover";

async function resolveContractCoverFileId({
  id,
  slug,
  updatedAt,
  locale,
}: {
  id: number;
  slug: string;
  updatedAt: Date;
  locale: "ru" | "en";
}) {
  try {
    const imageUrl = buildAbsoluteAppUrl(
      env.baseUrl,
      buildContractOgImagePath({ slug, locale, updatedAt }),
    );
    const response = await fetch(imageUrl, { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`Contract OG image request failed (${response.status})`);
    }

    const coverState = response.headers.get(CONTRACT_OG_COVER_STATE_HEADER);

    if (!isContractOgCoverStatePersistable(coverState)) {
      throw new Error(
        `Contract OG image is a transient fallback (${coverState ?? "missing"})`,
      );
    }

    const contentType = response.headers.get("content-type") || "image/png";
    const bytes = new Uint8Array(await response.arrayBuffer());

    return await getOrUploadTelegramRichPhoto({
      cacheKey: buildContractOgRichMediaCacheKey({
        contractId: id,
        locale,
        updatedAt,
      }),
      bytes,
      contentType,
      fileName: `favor-contract-${id}.png`,
    });
  } catch (error) {
    console.warn("[prepared-contract-message] cover image unavailable", {
      id,
      error,
    });
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
    const locale = payload.locale;
    const contract = await prisma.contract.findUnique({
      where: { slug: payload.slug },
      select: {
        id: true,
        status: true,
        titleRu: true,
        titleEn: true,
        descriptionRu: true,
        descriptionEn: true,
        type: true,
        category: true,
        tags: true,
        basePrice: true,
        deadlineDays: true,
        isEscrow: true,
        escrowCurrency: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            deals: {
              where: { status: { in: OPEN_DEAL_STATUSES } },
            },
          },
        },
      },
    });

    if (!contract || contract.status !== ContractStatus.active) {
      return fail("Contract is unavailable for publication.", 404, {
        code: "CONTRACT_UNAVAILABLE_FOR_PUBLICATION",
      });
    }

    const [completedDealsCount, uniqueViewsCount, rating, coverFileId] =
      await Promise.all([
        prisma.deal.count({
          where: { contractId: contract.id, status: DealStatus.completed },
        }),
        prisma.contractView.count({ where: { contractId: contract.id } }),
        prisma.review.aggregate({
          where: {
            deal: { contractId: contract.id, status: DealStatus.completed },
          },
          _avg: { rating: true },
          _count: { rating: true },
        }),
        resolveContractCoverFileId({
          id: contract.id,
          slug: payload.slug,
          updatedAt: contract.updatedAt,
          locale,
        }),
      ]);
    const { title, description } = resolveLocalizedContractContent(
      contract,
      locale,
      "Favor Deals",
    );
    const categoryLabel = getCategoryLabel(contract.category, locale);
    const browserUrl = buildAbsoluteAppUrl(
      env.baseUrl,
      getLocalizedPathname(locale, routes.contractBySlug(payload.slug)),
    );
    const miniAppUrl = buildTelegramMiniAppUrl(
      env.telegramBotUsername,
      buildContractDealIntentStartParam(payload.slug, telegramUser.telegramId),
    );
    const richMessageHtml = buildContractRichMessageHtml(
      {
        title,
        description,
        type: contract.type,
        category: contract.category,
        categoryLabel,
        tags: contract.tags,
        basePrice: contract.basePrice?.toString() ?? null,
        deadlineDays: contract.deadlineDays,
        isEscrow: contract.isEscrow,
        escrowCurrency: contract.escrowCurrency,
        openDealsCount: contract._count.deals,
        completedDealsCount,
        uniqueViewsCount,
        averageRating: rating._avg.rating,
        reviewsCount: rating._count.rating,
        createdAt: contract.createdAt,
        browserUrl,
        dealUrl: miniAppUrl,
        coverMediaId: coverFileId ? CONTRACT_COVER_MEDIA_ID : null,
      },
      locale,
    );
    const preparedMessage = await savePreparedInlineMessage({
      telegramUserId: telegramUser.telegramId,
      result: {
        type: "article",
        id: `contract-${contract.id}`,
        title,
        description: description.slice(0, 240),
        input_message_content: {
          rich_message: {
            html: richMessageHtml,
            media: coverFileId
              ? [
                  {
                    id: CONTRACT_COVER_MEDIA_ID,
                    media: {
                      type: "photo",
                      media: coverFileId,
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
    console.error("[api/telegram/prepared-contract-message] failed", error);
    return handleRouteError(error);
  }
}
