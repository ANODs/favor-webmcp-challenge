import { ContractStatus } from "@prisma/client";

import { handleRouteError, ok } from "@/shared/lib/api";
import { requireModerator } from "@/shared/lib/auth";
import { prisma } from "@/shared/lib/prisma";
import { env } from "@/shared/config/env";
import { notifyContractStatusChanged } from "@/features/contract-notifications";
import { getCategoryLabel } from "@/entities/category";
import {
  formatContractOgDeadlineDays,
  getContractGradientStyle,
} from "@/entities/contract";
import {
  revalidateContractPage,
  syncContractTelegramPostButton,
} from "@/entities/contract/server";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(_request: Request, { params }: Params) {
  try {
    await requireModerator();
    const { id } = await params;

    const existingContract = await prisma.contract.findUnique({
      where: { id: Number(id) },
      select: { status: true },
    });

    if (existingContract?.status !== ContractStatus.pending_moderation) {
      throw new Error("CONTRACT_NOT_PENDING_MODERATION");
    }

    const contract = await prisma.contract.update({
      where: {
        id: Number(id),
        status: ContractStatus.pending_moderation,
      },
      data: {
        status: ContractStatus.active,
        moderationComment: null,
      },
      include: {
        author: {
          select: {
            id: true,
            telegramId: true,
            isPremium: true,
          },
        },
        scout: {
          select: {
            id: true,
            telegramId: true,
          },
        },
      },
    });

    await notifyContractStatusChanged({
      contract,
      previousStatus: existingContract.status,
    });

    const isUnclaimedScoutContract =
      contract.scoutId !== null && contract.authorId === contract.scoutId;

    if (contract.telegramPostUrl && !isUnclaimedScoutContract) {
      const postButtonSync = await syncContractTelegramPostButton({
        slug: contract.slug,
        telegramPostUrl: contract.telegramPostUrl,
        telegramActorId: contract.author.telegramId,
        titleRu: contract.titleRu,
        titleEn: contract.titleEn,
      });

      if (postButtonSync.status === "failed" || postButtonSync.status === "skipped") {
        console.warn("[contract-approval] Telegram post button was not synchronized", {
          contractId: contract.id,
          status: postButtonSync.status,
          reason: postButtonSync.reason,
        });
      }
    }

    if (contract.author.isPremium && process.env.NODE_ENV === "production") {
      // Run generation asynchronously
      import("child_process").then(({ exec }) => {
        const publishedAt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" }).format(new Date());
        const imageUrl = Array.isArray(contract.mediaRefs) && contract.mediaRefs.length > 0 
          ? String(contract.mediaRefs[0]) 
          : "";
        const fallbackGradient = getContractGradientStyle(contract.slug);

        const payload = JSON.stringify({
          title: contract.titleRu || contract.titleEn || "",
          description: contract.descriptionRu || contract.descriptionEn || "",
          category: getCategoryLabel(contract.category, "ru") ?? contract.category ?? "",
          budget: contract.basePrice ? `${contract.basePrice} $` : "",
          deadline: contract.deadlineDays
            ? formatContractOgDeadlineDays(contract.deadlineDays, "ru")
            : "",
          publishedAt,
          imageUrl,
          fallbackGradient,
          botUsername: env.telegramBotUsername,
          locale: "ru",
        });

        exec(
          `node scripts/generate-og-image.js '${payload.replace(/'/g, "'\\''")}'`,
          { maxBuffer: 1024 * 1024 * 10 },
          (error, stdout, stderr) => {
            if (error) {
              console.error("Failed to generate OG image:", error, stderr);
              return;
            }

            const base64 = stdout.trim();
            if (base64) {
              console.log(`[OG Image] Successfully generated for contract ${contract.id}`);
              prisma.contract
                .update({
                  where: { id: contract.id },
                  data: { ogImageBase64: base64 },
                })
                .then(() => {
                  revalidateContractPage(contract.slug);
                })
                .catch((err) => console.error("Failed to save OG image to DB:", err));
            }
          }
        );
      });
    }

    revalidateContractPage(contract.slug);
    return ok(contract);
  } catch (error) {
    return handleRouteError(error);
  }
}
