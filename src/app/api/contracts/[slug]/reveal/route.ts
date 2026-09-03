import { requireUserCapability } from "@/entities/user/server";
import { handleRouteError, ok } from "@/shared/lib/api";
import { prisma } from "@/shared/lib/prisma";

type Params = {
  params: Promise<{
    slug: string;
  }>;
};

export async function POST(_request: Request, { params }: Params) {
  try {
    const user = await requireUserCapability("account:write");
    const { slug } = await params;

    const contract = await prisma.contract.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!contract) {
      throw new Error("CONTRACT_NOT_FOUND");
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { isPremium: true, premiumExpiresAt: true, adBalance: true, role: true },
    });

    const isPremium = dbUser?.isPremium || (dbUser?.premiumExpiresAt && dbUser.premiumExpiresAt > new Date());
    const isModerator = dbUser?.role === "moderator";

    await prisma.$transaction(async (tx) => {
      const existingReveal = await tx.contractReveal.findUnique({
        where: {
          userId_contractId: {
            userId: user.id,
            contractId: contract.id,
          },
        },
        select: { id: true },
      });

      if (existingReveal) {
        return;
      }

      if (!isPremium && !isModerator) {
        const balanceUpdate = await tx.user.updateMany({
          where: {
            id: user.id,
            adBalance: { gt: 0 },
          },
          data: { adBalance: { decrement: 1 } },
        });

        if (balanceUpdate.count !== 1) {
          throw new Error("CONTRACT_REVEAL_BALANCE_INSUFFICIENT");
        }
      }

      await tx.contractReveal.create({
        data: {
          userId: user.id,
          contractId: contract.id,
        },
      });
    });

    return ok({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
