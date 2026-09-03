import "dotenv/config";

import { prisma } from "../../src/shared/lib/prisma";
import { deleteRetainedAuthSessions } from "../../src/shared/lib/auth-session-store";

async function main() {
  try {
    const result = await deleteRetainedAuthSessions();
    console.info(`[cron/auth-sessions] removed ${result.count} retained sessions`);
  } catch (error) {
    console.error("[cron/auth-sessions] cleanup failed", error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
