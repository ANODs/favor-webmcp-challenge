import { ContractStatus } from "@prisma/client";

import { revalidateContractPage } from "@/entities/contract/server";
import { requireUserCapability } from "@/entities/user/server";
import { notifyDealCreated } from "@/features/deal-notifications";
import { notifyContractStatusChanged } from "@/features/contract-notifications";
import {
  initiateContractDeal,
  initiateContractDealSchema,
} from "@/features/initiate-contract-deal/server";
import { handleRouteError, ok } from "@/shared/lib/api";
import { prisma } from "@/shared/lib/prisma";
import { enforceRateLimit } from "@/shared/lib/rate-limit";

type Params = {
  params: Promise<{
    slug: string;
  }>;
};

export async function POST(request: Request, { params }: Params) {
  try {
    const user = await requireUserCapability("deal:create");
    await Promise.all([
      enforceRateLimit({
        key: `deal:create:burst:${user.id}`,
        limit: 3,
        windowMs: 10 * 60 * 1000,
      }),
      enforceRateLimit({
        key: `deal:create:day:${user.id}`,
        limit: 20,
        windowMs: 24 * 60 * 60 * 1000,
      }),
    ]);
    const { slug } = await params;
    const payload = initiateContractDealSchema.parse(await request.json());

    const result = await initiateContractDeal({
      slug,
      userId: user.id,
      telegramUserId: user.telegramId,
      payload,
    });

    if (result.updatedContract) {
      await notifyContractStatusChanged({
        contract: result.updatedContract,
        previousStatus: ContractStatus.active,
      });
      revalidateContractPage(result.contractSlug);
    }

    if (result.kind === "capacity_reached") {
      throw new Error("CONTRACT_DEAL_CAPACITY_REACHED");
    }

    const { deal } = result;

    const dealForNotifications = await prisma.deal.findUnique({
      where: {
        id: deal.id,
      },
      select: {
        id: true,
        status: true,
        details: true,
        price: true,
        deadlineDays: true,
        briefResources: true,
        contract: {
          select: {
            id: true,
            slug: true,
            titleRu: true,
            titleEn: true,
          },
        },
        customer: {
          select: {
            id: true,
            name: true,
            telegramId: true,
            telegramUsername: true,
          },
        },
        freelancer: {
          select: {
            id: true,
            name: true,
            telegramId: true,
            telegramUsername: true,
          },
        },
      },
    });

    if (dealForNotifications) {
      await notifyDealCreated(dealForNotifications);
    }

    return ok(deal, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
