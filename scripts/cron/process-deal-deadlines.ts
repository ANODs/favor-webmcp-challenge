import { processDealDeadlines } from "@/app/_server/process-deal-deadlines";
import { prisma } from "@/shared/lib/prisma";

async function main() {
  console.log("[deal-deadlines] starting processing cycle");

  try {
    const result = await processDealDeadlines({ database: prisma });
    console.log("[deal-deadlines] processing cycle completed", result);
  } catch (error) {
    console.error("[deal-deadlines] processing cycle failed", error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
