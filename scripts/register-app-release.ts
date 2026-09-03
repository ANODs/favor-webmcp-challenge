import { PrismaClient } from "@prisma/client";

import { formatAppVersion } from "@/shared/lib/app-version";
import {
  readBuildCommitSha,
  registerAppRelease,
} from "@/shared/lib/app-version/server";

const main = async () => {
  const database = new PrismaClient();

  try {
    const commitSha = await readBuildCommitSha();
    const release = await registerAppRelease(database, commitSha);

    process.stdout.write(`${formatAppVersion(release.patch).display}\n`);
  } finally {
    await database.$disconnect();
  }
};

main().catch((error) => {
  console.error(
    `[app-release] ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
