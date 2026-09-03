const APP_VERSION_MAJOR = 1;
const APP_VERSION_MINOR = 0;
const APP_VERSION_CHANNEL = "alpha";

const COMMIT_SHA_PATTERN = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i;

export type AppVersion = {
  canonical: string;
  display: string;
};

export const formatAppVersion = (patch: number): AppVersion => {
  if (!Number.isSafeInteger(patch) || patch < 0) {
    throw new Error("Application version patch must be a non-negative safe integer");
  }

  const baseVersion = `${APP_VERSION_MAJOR}.${APP_VERSION_MINOR}.${patch}`;

  return {
    canonical: `${baseVersion}-${APP_VERSION_CHANNEL}`,
    display: `${baseVersion} ${APP_VERSION_CHANNEL}`,
  };
};

export const normalizeCommitSha = (value: string): string => {
  const commitSha = value.trim().toLowerCase();

  if (!COMMIT_SHA_PATTERN.test(commitSha)) {
    throw new Error("Commit SHA must be a full 40- or 64-character hexadecimal value");
  }

  return commitSha;
};

export const DEFAULT_APP_VERSION = formatAppVersion(0);
