import { prisma } from "../../src/shared/lib/prisma";
import { reconcileDueCategoryAuctions } from "../../src/features/category-auction/server";

async function main() {
  const startedAt = Date.now();

  try {
    const results = await reconcileDueCategoryAuctions(100);
    const failed = results.filter((result) => result.status === "rejected");

    for (const result of failed) {
      console.error("[category-auctions] auction reconciliation failed", result.reason);
    }

    if (results.length > 0) {
      console.info(
        `[category-auctions] attempted=${results.length} succeeded=${results.length - failed.length} failed=${failed.length} durationMs=${Date.now() - startedAt}`,
      );
    }

    if (failed.length > 0) {
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("[category-auctions] reconciliation failed:", error);
  process.exitCode = 1;
});
