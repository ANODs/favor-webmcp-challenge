import { ContractStatus } from "@prisma/client";
import { z } from "zod";

import { revalidateContractPage } from "@/entities/contract/server";
import { handleRouteError, ok } from "@/shared/lib/api";
import { requireModerator } from "@/shared/lib/auth";
import { prisma } from "@/shared/lib/prisma";
import { notifyContractStatusChanged } from "@/features/contract-notifications";

const schema = z.object({
  comment: z.string().min(3).max(500),
});

type Params = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, { params }: Params) {
  try {
    await requireModerator();
    const { id } = await params;
    const { comment } = schema.parse(await request.json());

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
        status: ContractStatus.rejected,
        moderationComment: comment.trim(),
      },
      include: {
        author: { select: { id: true, telegramId: true } },
        scout: { select: { id: true, telegramId: true } },
      },
    });

    await notifyContractStatusChanged({
      contract,
      previousStatus: existingContract.status,
    });

    revalidateContractPage(contract.slug);

    return ok(contract);
  } catch (error) {
    return handleRouteError(error);
  }
}
