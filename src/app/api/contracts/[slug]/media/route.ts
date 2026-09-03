import { revalidateContractPage } from "@/entities/contract/server";
import { handleRouteError, ok } from "@/shared/lib/api";
import { prisma } from "@/shared/lib/prisma";
import { fetchTelegramPostPreview } from "@/shared/lib/telegram/server";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const contract = await prisma.contract.findUnique({
      where: { slug },
      select: { id: true, mediaRefs: true, telegramPostUrl: true },
    });

    if (!contract) {
      throw new Error("CONTRACT_NOT_FOUND");
    }

    if (!contract.telegramPostUrl) {
      return ok({ images: contract.mediaRefs ?? [] });
    }

    try {
      const preview = await fetchTelegramPostPreview(contract.telegramPostUrl);
      const currentMediaStr = JSON.stringify(contract.mediaRefs ?? []);
      const newMediaStr = JSON.stringify(preview.images ?? []);
      
      if (currentMediaStr !== newMediaStr) {
        await prisma.contract.update({
          where: { id: contract.id },
          data: { mediaRefs: preview.images },
        });
        revalidateContractPage(slug);
      }
      return ok({ images: preview.images });
    } catch (e) {
      console.warn(`[telegram-preview] Could not fetch preview for contract ${contract.id} (${(e as Error).message})`);
      return ok({ images: contract.mediaRefs ?? [] });
    }
  } catch (error) {
    return handleRouteError(error);
  }
}
