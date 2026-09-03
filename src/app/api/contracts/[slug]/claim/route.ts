import { ContractStatus } from "@prisma/client";

import { requireUserCapability } from "@/entities/user/server";
import { fail, handleRouteError, ok } from "@/shared/lib/api";
import { prisma } from "@/shared/lib/prisma";
import { checkContractLimit } from "@/shared/lib/contract-limits";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const user = await requireUserCapability("contract:publish");
    const { slug } = await params;

    const contract = await prisma.contract.findUnique({
      where: { slug },
    });

    if (!contract) {
      return fail("Contract not found.", 404, { code: "CONTRACT_NOT_FOUND" });
    }

    const limitCheck = await checkContractLimit(
      user.id,
      user.isPremium,
      false,
      user.role,
    );
    if (!limitCheck.allowed) {
      return fail(limitCheck.error, limitCheck.status, {
        code: limitCheck.code,
        ...limitCheck.details,
      });
    }

    if (
      contract.status !== ContractStatus.active ||
      contract.scoutId === null ||
      contract.authorId !== contract.scoutId
    ) {
      return fail("Contract claim is not available.", 400, {
        code: "CONTRACT_CLAIM_UNAVAILABLE",
      });
    }

    if (!contract.telegramPostUrl) {
      return fail("The contract has no Telegram post URL.", 400, {
        code: "CONTRACT_TELEGRAM_POST_REQUIRED",
      });
    }

    // Generate a deterministic verification code bound to this contract
    const verificationCode = `#favor_verify_${contract.slug}`;

    return ok({ verificationCode });
  } catch (error) {
    return handleRouteError(error);
  }
}
