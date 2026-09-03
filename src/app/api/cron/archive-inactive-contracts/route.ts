import { NextResponse } from "next/server";
import { prisma } from "@/shared/lib/prisma";
import { ContractStatus, DealStatus } from "@prisma/client";
import { revalidateContractPage } from "@/entities/contract/server";
import { notifyContractStatusChanged } from "@/features/contract-notifications";

export async function GET(request: Request) {
  // Check authorization via CRON_SECRET if it's set in the environment
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const statusesToArchive: ContractStatus[] = [
      ContractStatus.active,
      ContractStatus.limit_reached,
      ContractStatus.unclaimed,
    ];

    // Find contracts that:
    // - Have one of the statusesToArchive
    // - Were created more than 3 months ago
    // - Have NO views in the last 3 months
    // - Have NO deals updated in the last 3 months OR any open deals
    const contractsToArchive = await prisma.contract.findMany({
      where: {
        status: { in: statusesToArchive },
        createdAt: { lt: threeMonthsAgo },
        views: {
          none: {
            createdAt: { gte: threeMonthsAgo },
          },
        },
        deals: {
          none: {
            OR: [
              {
                updatedAt: { gte: threeMonthsAgo },
              },
              {
                status: {
                  notIn: [
                    DealStatus.completed,
                    DealStatus.cancelled,
                    DealStatus.rejected,
                  ],
                },
              },
            ],
          },
        },
      },
      select: {
        id: true,
        slug: true,
        titleRu: true,
        titleEn: true,
        status: true,
        author: { select: { id: true, telegramId: true } },
        scout: { select: { id: true, telegramId: true } },
      },
    });

    if (contractsToArchive.length === 0) {
      return NextResponse.json({
        message: "No inactive contracts found to archive.",
        count: 0,
      });
    }

    const contractIds = contractsToArchive.map((c) => c.id);

    const result = await prisma.contract.updateMany({
      where: { id: { in: contractIds } },
      data: { status: ContractStatus.archived },
    });

    for (const contract of contractsToArchive) {
      revalidateContractPage(contract.slug);
    }

    // Notify users in the background
    Promise.allSettled(
      contractsToArchive.map((contract) =>
        notifyContractStatusChanged({
          contract: { ...contract, status: ContractStatus.archived },
          previousStatus: contract.status,
        })
      )
    );

    return NextResponse.json({
      message: "Inactive contracts successfully archived.",
      count: result.count,
      archivedIds: contractIds,
    });
  } catch (error) {
    console.error("Error archiving inactive contracts:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
