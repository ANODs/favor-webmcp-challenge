import { ContractStatus } from "@prisma/client";

import {
  buildContractManagementWriteWhere,
  canManageContract,
  isUnclaimedScoutContract,
} from "@/entities/contract";
import {
  rethrowContractManagementWriteError,
  revalidateContractPage,
  serializeContractMutationResponse,
} from "@/entities/contract/server";
import { requireUserCapability } from "@/entities/user/server";
import { fail, handleRouteError, ok } from "@/shared/lib/api";
import { prisma } from "@/shared/lib/prisma";
import { checkContractLimit } from "@/shared/lib/contract-limits";
import { notifyContractStatusChanged } from "@/features/contract-notifications";

type Params = {
  params: Promise<{
    slug: string;
  }>;
};

export async function POST(_request: Request, { params }: Params) {
  try {
    const user = await requireUserCapability("contract:publish");
    const { slug } = await params;

    const existing = await prisma.contract.findUnique({
      where: { slug },
      select: { id: true, authorId: true, status: true, scoutId: true },
    });

    if (!existing) {
      throw new Error("CONTRACT_NOT_FOUND");
    }

    if (!canManageContract(existing, user)) {
      throw new Error("FORBIDDEN");
    }

    if (existing.status !== ContractStatus.archived) {
      throw new Error("CONTRACT_RESTORE_REQUIRES_ARCHIVED_STATUS");
    }

    const isScouting = isUnclaimedScoutContract(existing);
    const limitCheck = await checkContractLimit(
      user.id,
      user.isPremium,
      isScouting,
      user.role,
    );
    if (!limitCheck.allowed) {
      return fail(limitCheck.error, limitCheck.status, {
        code: limitCheck.code,
        ...limitCheck.details,
      });
    }

    const restored = await prisma.contract
      .update({
        where: {
          ...buildContractManagementWriteWhere(existing.id, user),
          status: ContractStatus.archived,
        },
        data: {
          status: ContractStatus.pending_moderation,
          moderationComment: null,
          ogImageBase64: null,
        },
        include: {
          author: { select: { id: true, telegramId: true } },
          scout: { select: { id: true, telegramId: true } },
        },
      })
      .catch(rethrowContractManagementWriteError);

    await notifyContractStatusChanged({
      contract: restored,
      previousStatus: existing.status,
    });

    revalidateContractPage(slug);

    return ok(serializeContractMutationResponse(restored));
  } catch (error) {
    return handleRouteError(error);
  }
}
