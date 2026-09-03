import { ContractReferralSource, ContractStatus } from "@prisma/client";

import {
  claimScoutedContractAuthor,
  ContractClaimConflictError,
  ContractClaimLimitError,
  revalidateContractPage,
  syncContractTelegramPostButton,
} from "@/entities/contract/server";
import { requireUserCapability } from "@/entities/user/server";
import { fail, handleRouteError, ok } from "@/shared/lib/api";
import { ensureContractReferralForClaim } from "@/features/contract-referrals/server";
import { prisma } from "@/shared/lib/prisma";
import { checkContractLimit } from "@/shared/lib/contract-limits";
import { fetchTelegramPostSnapshot } from "@/shared/lib/telegram/server";

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

    const scoutId = contract.scoutId;

    if (
      contract.status !== ContractStatus.active ||
      scoutId === null ||
      contract.authorId !== scoutId
    ) {
      return fail("Contract verification is not available.", 400, {
        code: "CONTRACT_VERIFICATION_UNAVAILABLE",
      });
    }

    const verificationCode = `#favor_verify_${contract.slug}`;

    if (!contract.telegramPostUrl) {
      return fail("The contract has no Telegram post URL.", 400, {
        code: "CONTRACT_TELEGRAM_POST_REQUIRED",
      });
    }

    try {
      const postSnapshot = await fetchTelegramPostSnapshot(contract.telegramPostUrl);

      if (!postSnapshot.plainText.includes(verificationCode)) {
        return fail(
          "The verification code was not found in the Telegram post.",
          400,
          { code: "CONTRACT_VERIFICATION_CODE_NOT_FOUND" },
        );
      }

      // Verification successful
      const updatedContract = await prisma.$transaction(async (tx) => {
        const updated = await claimScoutedContractAuthor(tx, {
          contractId: contract.id,
          scoutId,
          claimantId: user.id,
          claimantIsPremium: user.isPremium,
          claimantRole: user.role,
        });

        if (scoutId !== user.id) {
          await ensureContractReferralForClaim(tx, {
            contractId: contract.id,
            referrerId: scoutId,
            authorId: user.id,
            source: ContractReferralSource.scout,
          });
        }

        return updated;
      });

      const postButtonSync = await syncContractTelegramPostButton({
        slug: contract.slug,
        telegramPostUrl: contract.telegramPostUrl,
        telegramActorId: user.telegramId,
        titleRu: contract.titleRu,
        titleEn: contract.titleEn,
        existingSnapshot: postSnapshot,
      });

      if (postButtonSync.status === "failed" || postButtonSync.status === "skipped") {
        console.warn("[contract-claim] Telegram post button was not synchronized", {
          contractId: contract.id,
          status: postButtonSync.status,
          reason: postButtonSync.reason,
        });
      }

      revalidateContractPage(contract.slug);

      return ok(updatedContract);
    } catch (e) {
      if (e instanceof ContractClaimConflictError) {
        return fail("The contract was claimed by another author.", 409, {
          code: "CONTRACT_CLAIM_CONFLICT",
        });
      }
      if (e instanceof ContractClaimLimitError) {
        return fail(e.message, 400);
      }

      console.error("Error verifying telegram post:", e);
      return fail("Telegram post verification failed.", 400, {
        code: "CONTRACT_VERIFICATION_FAILED",
      });
    }
  } catch (error) {
    return handleRouteError(error);
  }
}
