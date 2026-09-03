import {
  syncContractTelegramPostButton,
  withLockedManagedContract,
} from "@/entities/contract/server";
import { requireUserCapability } from "@/entities/user/server";
import { fail, handleRouteError, ok } from "@/shared/lib/api";
import { prisma } from "@/shared/lib/prisma";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const user = await requireUserCapability("contract:publish");
    const { slug } = await params;
    const mutation = await prisma.$transaction(
      (tx) =>
        withLockedManagedContract(tx, { slug, user }, (contract) =>
          syncContractTelegramPostButton({
            slug: contract.slug,
            telegramPostUrl: contract.telegramPostUrl,
            telegramActorId: user.telegramId,
            titleRu: contract.titleRu,
            titleEn: contract.titleEn,
          }),
        ),
      { maxWait: 5_000, timeout: 60_000 },
    );

    if (mutation.status === "not_found") {
      return fail("Contract not found.", 404, { code: "CONTRACT_NOT_FOUND" });
    }

    if (mutation.status === "forbidden") {
      return fail("Telegram post update is forbidden.", 403, {
        code: "CONTRACT_TELEGRAM_POST_FORBIDDEN",
      });
    }

    return ok(mutation.data);
  } catch (error) {
    return handleRouteError(error);
  }
}
