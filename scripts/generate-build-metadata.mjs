import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const COMMIT_SHA_PATTERN = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i;
const SYMBOLIC_REF_PATTERN = /^refs\/[a-zA-Z0-9._/-]+$/;

const normalizeCommitSha = (value, source) => {
  const commitSha = value.trim().toLowerCase();

  if (!COMMIT_SHA_PATTERN.test(commitSha)) {
    throw new Error(`${source} must contain a full Git commit SHA`);
  }

  return commitSha;
};

const validateSymbolicRef = (value) => {
  const refName = value.trim();
  const segments = refName.split("/");

  if (
    !SYMBOLIC_REF_PATTERN.test(refName) ||
    segments.some((segment) => segment === "." || segment === "..")
  ) {
    throw new Error(`Unsupported symbolic Git ref: ${refName}`);
  }

  return refName;
};

const readOptionalFile = async (filePath) => {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
};

const findPackedRef = (contents, refName) => {
  for (const line of contents.split(/\r?\n/)) {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith("#") || trimmedLine.startsWith("^")) {
      continue;
    }

    const separatorIndex = trimmedLine.indexOf(" ");
    if (separatorIndex === -1) {
      continue;
    }

    const commitSha = trimmedLine.slice(0, separatorIndex);
    const packedRefName = trimmedLine.slice(separatorIndex + 1).trim();

    if (packedRefName === refName) {
      return commitSha;
    }
  }

  return null;
};

export const resolveCommitSha = async ({
  workingDirectory = process.cwd(),
  environment = process.env,
} = {}) => {
  const configuredCommitSha = environment.APP_COMMIT_SHA?.trim();

  if (configuredCommitSha) {
    return normalizeCommitSha(configuredCommitSha, "APP_COMMIT_SHA");
  }

  const gitDirectory = path.join(workingDirectory, ".git");
  const headContents = await readOptionalFile(path.join(gitDirectory, "HEAD"));

  if (!headContents) {
    throw new Error(
      "Cannot determine the build commit: provide APP_COMMIT_SHA or include safe .git metadata",
    );
  }

  const trimmedHead = headContents.trim();
  if (!trimmedHead.startsWith("ref:")) {
    return normalizeCommitSha(trimmedHead, ".git/HEAD");
  }

  const refName = validateSymbolicRef(trimmedHead.slice("ref:".length));
  const looseRefContents = await readOptionalFile(
    path.join(gitDirectory, ...refName.split("/")),
  );

  if (looseRefContents) {
    return normalizeCommitSha(looseRefContents, `.git/${refName}`);
  }

  const packedRefsContents = await readOptionalFile(path.join(gitDirectory, "packed-refs"));
  const packedCommitSha = packedRefsContents
    ? findPackedRef(packedRefsContents, refName)
    : null;

  if (!packedCommitSha) {
    throw new Error(`Cannot resolve Git ref ${refName}`);
  }

  return normalizeCommitSha(packedCommitSha, `.git/packed-refs (${refName})`);
};

export const generateBuildMetadata = async ({
  workingDirectory = process.cwd(),
  environment = process.env,
  outputPath = path.join(workingDirectory, "app-build.json"),
} = {}) => {
  const commitSha = await resolveCommitSha({ workingDirectory, environment });
  const metadata = { commitSha };

  await writeFile(outputPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
  return metadata;
};

const isMainModule =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMainModule) {
  generateBuildMetadata().catch((error) => {
    console.error(
      `[build-metadata] ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  });
}
