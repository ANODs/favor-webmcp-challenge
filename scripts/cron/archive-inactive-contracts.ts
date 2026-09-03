import { PrismaClient, ContractStatus, DealStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting cron job: archive-inactive-contracts");

  try {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const statusesToArchive: ContractStatus[] = [
      ContractStatus.active,
      ContractStatus.limit_reached,
      ContractStatus.unclaimed,
    ];

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
      select: { id: true },
    });

    if (contractsToArchive.length === 0) {
      console.log("No inactive contracts found to archive.");
      return;
    }

    const contractIds = contractsToArchive.map((c) => c.id);

    const result = await prisma.contract.updateMany({
      where: { id: { in: contractIds } },
      data: { status: ContractStatus.archived },
    });

    console.log(
      `Inactive contracts successfully archived. Count: ${result.count}`
    );
    console.log(`Archived IDs: ${contractIds.join(", ")}`);
  } catch (error) {
    console.error("Error archiving inactive contracts:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
