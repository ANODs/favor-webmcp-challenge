import { env } from "@/shared/config/env";
import { proxyFetch } from "@/shared/lib/telegram/proxy-fetch";

type TelegramPhotoSize = {
  file_id: string;
  file_size?: number;
  height: number;
  width: number;
};

type TelegramApiResponse<T> = {
  ok: boolean;
  result?: T;
};

type TelegramUserProfilePhotos = {
  photos: TelegramPhotoSize[][];
};

type TelegramFile = {
  file_path?: string;
};

const getTelegramImageContentType = (filePath: string) => {
  const extension = filePath.split(".").pop()?.toLowerCase();

  switch (extension) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    default:
      return null;
  }
};

const requestTelegramApi = async <T>(method: string, searchParams: URLSearchParams) => {
  const token = env.requireTelegramBotToken();
  const response = await proxyFetch(
    `https://api.telegram.org/bot${token}/${method}?${searchParams.toString()}`,
  );

  if (!response.ok) {
    throw new Error(`Telegram API request failed with status ${response.status}`);
  }

  const payload = await response.json() as TelegramApiResponse<T>;

  if (!payload.ok || payload.result === undefined) {
    throw new Error("Telegram API returned an unsuccessful response");
  }

  return payload.result;
};

export async function fetchTelegramAvatar(telegramId: string) {
  const avatarFileId = await getTelegramAvatarFileId(telegramId);

  if (!avatarFileId) {
    return null;
  }

  const file = await requestTelegramApi<TelegramFile>(
    "getFile",
    new URLSearchParams({ file_id: avatarFileId }),
  );

  if (!file.file_path) {
    return null;
  }

  const token = env.requireTelegramBotToken();
  const response = await proxyFetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`);
  const inferredContentType = getTelegramImageContentType(file.file_path);

  if (
    !inferredContentType ||
    response.headers.get("content-type")?.toLowerCase().startsWith("image/")
  ) {
    return response;
  }

  const headers = new Headers(response.headers);
  headers.set("content-type", inferredContentType);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function getTelegramAvatarFileId(telegramId: string) {
  const profilePhotos = await requestTelegramApi<TelegramUserProfilePhotos>(
    "getUserProfilePhotos",
    new URLSearchParams({ user_id: telegramId, limit: "1" }),
  );
  const photoSizes = profilePhotos.photos[0];

  if (!photoSizes?.length) {
    return null;
  }

  const largestPhoto = photoSizes.reduce((largest, candidate) => {
    const largestArea = largest.width * largest.height;
    const candidateArea = candidate.width * candidate.height;

    if (candidateArea !== largestArea) {
      return candidateArea > largestArea ? candidate : largest;
    }

    return (candidate.file_size ?? 0) > (largest.file_size ?? 0) ? candidate : largest;
  });
  return largestPhoto.file_id;
}
