import { revalidatePath } from "next/cache";

import { revalidateContractPage } from "@/entities/contract/server";
import { reconcileDueOnchainSubscriptionPayments } from "@/features/favor-subscription/server";
import { handleRouteError, ok } from "@/shared/lib/api";
import { prisma } from "@/shared/lib/prisma";

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    const now = new Date();

    const [expiredUsers, subscriptionReconciliation] = await Promise.all([
      prisma.user.findMany({
        where: {
          isPremium: true,
          premiumExpiresAt: { lt: now },
        },
        select: {
          id: true,
          contracts: {
            select: { id: true, slug: true },
          },
        },
      }),
      reconcileDueOnchainSubscriptionPayments(),
    ]);

    if (expiredUsers.length === 0) {
      return ok({
        usersUpdated: 0,
        contractsUpdated: 0,
        subscriptionReconciliation,
      });
    }

    const expiredUserIds = expiredUsers.map((u) => u.id);
    const allContracts = expiredUsers.flatMap((u) => u.contracts);
    const allContractIds = allContracts.map((c) => c.id);

    const [updatedUsers, updatedContracts] = await prisma.$transaction([
      prisma.user.updateMany({
        where: {
          id: { in: expiredUserIds },
          isPremium: true,
          premiumExpiresAt: { lt: now },
        },
        data: { isPremium: false },
      }),
      prisma.contract.updateMany({
        where: {
          id: { in: allContractIds },
          author: { premiumExpiresAt: { lt: now } },
        },
        data: { ogImageBase64: null },
      }),
    ]);

    for (const contract of allContracts) {
      revalidateContractPage(contract.slug);
    }

    revalidatePath("/sitemap.xml");

    console.log(
      `[cron/revalidate-expired-premium] Users downgraded: ${updatedUsers.count}, contracts cleared: ${updatedContracts.count}`
    );

    return ok({
      usersUpdated: updatedUsers.count,
      contractsUpdated: updatedContracts.count,
      subscriptionReconciliation,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
