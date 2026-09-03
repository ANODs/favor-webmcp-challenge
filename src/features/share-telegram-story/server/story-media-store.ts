import { randomBytes } from "node:crypto";
import { mkdir, readdir, stat, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const STORY_MEDIA_MAX_BYTES = 96 * 1024 * 1024;
export const STORY_MEDIA_TTL_MS = 2 * 60 * 60 * 1000;
const STORY_MEDIA_MAX_FILES = 64;
const TOKEN_PATTERN = /^[a-f0-9]{64}$/;
const storageDirectory = join(tmpdir(), "favor-story-media");

const pathForToken = (token: string) => join(storageDirectory, `${token}.mp4`);

const removeFile = async (path: string) => {
  try {
    await unlink(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
};

const cleanupStoryMedia = async () => {
  await mkdir(storageDirectory, { recursive: true });
  const now = Date.now();
  const entries = await readdir(storageDirectory, { withFileTypes: true });
  const files = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && /^[a-f0-9]{64}\.mp4$/.test(entry.name))
      .map(async (entry) => {
        const path = join(storageDirectory, entry.name);
        const metadata = await stat(path);
        return { path, mtimeMs: metadata.mtimeMs };
      }),
  );
  const active = [] as typeof files;
  for (const file of files) {
    if (now - file.mtimeMs > STORY_MEDIA_TTL_MS) {
      await removeFile(file.path);
    } else {
      active.push(file);
    }
  }
  active.sort((left, right) => right.mtimeMs - left.mtimeMs);
  await Promise.all(active.slice(STORY_MEDIA_MAX_FILES).map((file) => removeFile(file.path)));
};

export const saveStoryMedia = async (bytes: Uint8Array) => {
  await cleanupStoryMedia();
  const token = randomBytes(32).toString("hex");
  const path = pathForToken(token);
  await writeFile(path, bytes, { flag: "wx" });
  return {
    token,
    expiresAt: new Date(Date.now() + STORY_MEDIA_TTL_MS),
  };
};

export const getStoryMedia = async (token: string) => {
  if (!TOKEN_PATTERN.test(token)) return null;
  const path = pathForToken(token);
  try {
    const metadata = await stat(path);
    if (!metadata.isFile() || Date.now() - metadata.mtimeMs > STORY_MEDIA_TTL_MS) {
      await removeFile(path);
      return null;
    }
    return { path, size: metadata.size };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
};

export type StoryMediaRange = { start: number; end: number } | "invalid" | null;

export const parseStoryMediaRange = (
  header: string | null,
  size: number,
): StoryMediaRange => {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return "invalid";

  const rawStart = match[1];
  const rawEnd = match[2];
  if (!rawStart && !rawEnd) return "invalid";

  if (!rawStart) {
    const suffixLength = Number(rawEnd);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return "invalid";
    return { start: Math.max(0, size - suffixLength), end: size - 1 };
  }

  const start = Number(rawStart);
  const end = rawEnd ? Number(rawEnd) : size - 1;
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    start >= size ||
    end < start
  ) {
    return "invalid";
  }
  return { start, end: Math.min(end, size - 1) };
};
