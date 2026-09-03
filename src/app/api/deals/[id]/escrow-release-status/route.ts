import { getEscrowReleaseProof } from "@/shared/lib/ton/escrow-status.server";
import { handleRouteError, ok } from "@/shared/lib/api";
import { requireUser } from "@/shared/lib/auth";
import { prisma } from "@/shared/lib/prisma";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const deal = await prisma.deal.findUnique({
      where: { id: Number(id) },
      select: {
        customerId: true,
        freelancerId: true,
        isEscrow: true,
        escrowAddress: true,
      },
    });

    if (!deal) {
      throw new Error("NOT_FOUND");
    }

    if (deal.customerId !== user.id && deal.freelancerId !== user.id) {
      throw new Error("FORBIDDEN");
    }

    if (!deal.isEscrow || !deal.escrowAddress) {
      throw new Error("Escrow contract is not prepared.");
    }

    const proof = await getEscrowReleaseProof(deal.escrowAddress);

    return ok({
      released: proof.released,
      refunded: proof.refunded,
      status: proof.status?.toString() ?? null,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
