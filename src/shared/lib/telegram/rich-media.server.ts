import { createHash } from "node:crypto";

import { env } from "@/shared/config/env";
import { prisma } from "@/shared/lib/prisma";

import { createProxyFormData, proxyFetch } from "./proxy-fetch";

type TelegramPhotoSize = {
  file_id: string;
  file_size?: number;
  height: number;
  width: number;
};

type TelegramPhotoMessage = {
  message_id: number;
  photo?: TelegramPhotoSize[];
};

type TelegramApiResponse<T> =
  | { ok: true; result: T }
  | { ok: false; error_code?: number; description?: string };

type TelegramRichPhotoUpload = {
  cacheKey: string;
  bytes: Uint8Array;
  contentType: string;
  fileName: string;
};

const MAX_CACHED_FILE_IDS = 128;
const fileIdCache = new Map<string, Promise<string>>();
let persistentReadWarningLogged = false;
let persistentWriteWarningLogged = false;

const fingerprintBotToken = (token: string) =>
  createHash("sha256").update(token, "utf8").digest("hex");

const buildScopedCacheKey = (cacheKey: string, botTokenFingerprint: string) =>
  `${botTokenFingerprint}:${cacheKey}`;

const telegramApiUrl = (token: string, method: string) =>
  `https://api.telegram.org/bot${token}/${method}`;

const selectLargestPhoto = (photos: TelegramPhotoSize[]) =>
  photos.reduce((largest, candidate) => {
    const largestArea = largest.width * largest.height;
    const candidateArea = candidate.width * candidate.height;

    if (candidateArea !== largestArea) {
      return candidateArea > largestArea ? candidate : largest;
    }

    return (candidate.file_size ?? 0) > (largest.file_size ?? 0) ? candidate : largest;
  });

async function deleteCacheMessage(token: string, chatId: string, messageId: number) {
  try {
    const response = await proxyFetch(telegramApiUrl(token, "deleteMessage"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
    });
    const data = (await response.json().catch(() => null)) as
      | TelegramApiResponse<boolean>
      | null;

    if (!response.ok || !data?.ok) {
      console.warn("[telegram-rich-media] failed to delete cache message", {
        status: response.status,
        description: data && !data.ok ? data.description : undefined,
      });
    }
  } catch (error) {
    console.warn("[telegram-rich-media] failed to delete cache message", error);
  }
}

async function uploadTelegramPhoto(
  {
    bytes,
    contentType,
    fileName,
  }: Omit<TelegramRichPhotoUpload, "cacheKey">,
  token: string,
) {
  const chatId = env.requireTelegramSupportChatId();
  const formData = createProxyFormData();
  formData.append("chat_id", chatId);
  formData.append("disable_notification", "true");
  formData.append(
    "photo",
    new Blob([new Uint8Array(bytes)], { type: contentType }),
    fileName,
  );

  const response = await proxyFetch(telegramApiUrl(token, "sendPhoto"), {
    method: "POST",
    body: formData,
  });
  const data = (await response.json().catch(() => null)) as
    | TelegramApiResponse<TelegramPhotoMessage>
    | null;

  if (!response.ok || !data?.ok) {
    const description = data && !data.ok ? data.description : null;
    throw new Error(
      `Telegram rich media upload failed (${response.status}): ${description || "Unknown error"}`,
    );
  }

  const message = data.result;

  try {
    if (!message.photo?.length) {
      throw new Error("Telegram rich media upload returned no reusable photo");
    }

    return selectLargestPhoto(message.photo).file_id;
  } finally {
    await deleteCacheMessage(token, chatId, message.message_id);
  }
}

async function readPersistentFileId(
  cacheKey: string,
  botTokenFingerprint: string,
) {
  try {
    const cached = await prisma.telegramRichMediaCache.findFirst({
      where: {
        cacheKey,
        botTokenFingerprint,
      },
      select: { fileId: true },
    });

    return cached?.fileId ?? null;
  } catch (error) {
    if (!persistentReadWarningLogged) {
      persistentReadWarningLogged = true;
      console.warn("[telegram-rich-media] failed to read persistent cache", error);
    }
    return null;
  }
}

async function writePersistentFileId({
  cacheKey,
  botTokenFingerprint,
  fileId,
}: {
  cacheKey: string;
  botTokenFingerprint: string;
  fileId: string;
}) {
  try {
    await prisma.telegramRichMediaCache.upsert({
      where: { cacheKey },
      create: {
        cacheKey,
        botTokenFingerprint,
        fileId,
      },
      update: {
        botTokenFingerprint,
        fileId,
      },
    });
  } catch (error) {
    if (!persistentWriteWarningLogged) {
      persistentWriteWarningLogged = true;
      console.warn("[telegram-rich-media] failed to write persistent cache", error);
    }
  }
}

async function resolveTelegramRichPhoto(
  params: TelegramRichPhotoUpload,
  token: string,
  botTokenFingerprint: string,
) {
  const persistedFileId = await readPersistentFileId(
    params.cacheKey,
    botTokenFingerprint,
  );

  if (persistedFileId) {
    return persistedFileId;
  }

  const fileId = await uploadTelegramPhoto(params, token);
  await writePersistentFileId({
    cacheKey: params.cacheKey,
    botTokenFingerprint,
    fileId,
  });

  return fileId;
}

export async function getOrUploadTelegramRichPhoto(params: TelegramRichPhotoUpload) {
  const token = env.requireTelegramBotToken();
  const botTokenFingerprint = fingerprintBotToken(token);
  const scopedCacheKey = buildScopedCacheKey(params.cacheKey, botTokenFingerprint);
  const cached = fileIdCache.get(scopedCacheKey);

  if (cached) {
    return cached;
  }

  const upload = resolveTelegramRichPhoto(params, token, botTokenFingerprint);
  fileIdCache.set(scopedCacheKey, upload);

  if (fileIdCache.size > MAX_CACHED_FILE_IDS) {
    const oldestKey = fileIdCache.keys().next().value;
    if (oldestKey) {
      fileIdCache.delete(oldestKey);
    }
  }

  try {
    return await upload;
  } catch (error) {
    fileIdCache.delete(scopedCacheKey);
    throw error;
  }
}
