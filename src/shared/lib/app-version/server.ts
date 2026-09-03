import { readFile } from "node:fs/promises";
import path from "node:path";

import type { PrismaClient } from "@prisma/client";

import { normalizeCommitSha } from "./model";

const APP_RELEASE_LOCK_ID = 7_341_927_551_003_141n;

type BuildMetadata = {
  commitSha?: unknown;
};

export const readBuildCommitSha = async ({
  workingDirectory = process.cwd(),
  environment = process.env,
}: {
  workingDirectory?: string;
  environment?: NodeJS.ProcessEnv;
} = {}): Promise<string> => {
  const configuredCommitSha = environment.APP_COMMIT_SHA?.trim();
  if (configuredCommitSha) {
    return normalizeCommitSha(configuredCommitSha);
  }

  const metadataPath = path.join(workingDirectory, "app-build.json");
  let metadata: BuildMetadata;

  try {
    metadata = JSON.parse(await readFile(metadataPath, "utf8")) as BuildMetadata;
  } catch (error) {
    throw new Error(`Cannot read build metadata at ${metadataPath}`, { cause: error });
  }

  if (typeof metadata.commitSha !== "string") {
    throw new Error(`Build metadata at ${metadataPath} does not contain commitSha`);
  }

  return normalizeCommitSha(metadata.commitSha);
};

export const registerAppRelease = async (
  database: PrismaClient,
  commitShaInput: string,
) => {
  const commitSha = normalizeCommitSha(commitShaInput);

  return database.$transaction(async (transaction) => {
    await transaction.$queryRaw`
      SELECT pg_advisory_xact_lock(${APP_RELEASE_LOCK_ID})::text AS "lock"
    `;

    const existingRelease = await transaction.appRelease.findUnique({
      where: { commitSha },
    });

    if (existingRelease) {
      return existingRelease;
    }

    const latestRelease = await transaction.appRelease.findFirst({
      orderBy: { patch: "desc" },
      select: { patch: true },
    });

    return transaction.appRelease.create({
      data: {
        commitSha,
        patch: (latestRelease?.patch ?? -1) + 1,
      },
    });
  });
};
