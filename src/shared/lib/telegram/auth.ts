import crypto from "node:crypto";
import { z } from "zod";

import { env } from "@/shared/config/env";

const telegramStarsRatingSchema = z.object({
  level: z.number().int(),
  current_level_stars: z.union([z.number(), z.bigint()]).optional(),
  stars: z.union([z.number(), z.bigint()]).optional(),
  next_level_stars: z.union([z.number(), z.bigint()]).optional(),
});

const telegramUserSchema = z.object({
  id: z.union([z.number(), z.bigint()]),
  username: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  language_code: z.string().optional(),
  photo_url: z.string().url().optional(),
  is_premium: z.boolean().optional(),
  allows_write_to_pm: z.boolean().optional(),
  gift_level: z.number().int().optional(),
  tg_level: z.number().int().optional(),
  telegram_level: z.number().int().optional(),
  level: z.number().int().optional(),
  stars_rating: telegramStarsRatingSchema.optional(),
  stars_my_pending_rating: telegramStarsRatingSchema.optional(),
  star_rating: telegramStarsRatingSchema.optional(),
});

export const telegramAuthSchema = z.object({
  initData: z.string().min(1, "initData is required"),
  startParam: z.string().trim().min(1).optional().nullable(),
});

export type TelegramAuthPayload = z.infer<typeof telegramUserSchema>;

const resolveTelegramLevel = (payload: TelegramAuthPayload) =>
  payload.stars_rating?.level ??
  payload.stars_my_pending_rating?.level ??
  payload.star_rating?.level ??
  payload.gift_level ??
  payload.tg_level ??
  payload.telegram_level ??
  payload.level ??
  null;

const readStartParam = (params: URLSearchParams) => params.get("start_param")?.trim() || null;

const getSecretKey = () =>
  crypto.createHmac("sha256", "WebAppData").update(env.requireTelegramBotToken()).digest();

const createCheckString = (params: URLSearchParams) =>
  [...params.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

export const isTelegramAuthDateFresh = (
  authDate: number,
  nowSeconds = Math.floor(Date.now() / 1000),
) =>
  Number.isSafeInteger(authDate) &&
  authDate <= nowSeconds + 60 &&
  nowSeconds - authDate <= 60 * 60;

export const verifyTelegramInitData = (initData: string) => {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");

  if (!hash) {
    throw new Error("Telegram initData does not contain hash.");
  }

  const checkString = createCheckString(params);
  const calculatedHash = crypto
    .createHmac("sha256", getSecretKey())
    .update(checkString)
    .digest("hex");
  const receivedHashBuffer = /^[a-f0-9]{64}$/i.test(hash)
    ? Buffer.from(hash, "hex")
    : Buffer.alloc(0);
  const calculatedHashBuffer = Buffer.from(calculatedHash, "hex");

  if (
    receivedHashBuffer.length !== calculatedHashBuffer.length ||
    !crypto.timingSafeEqual(receivedHashBuffer, calculatedHashBuffer)
  ) {
    throw new Error("Telegram initData signature is invalid.");
  }

  const authDate = Number(params.get("auth_date"));
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!isTelegramAuthDateFresh(authDate, nowSeconds)) {
    throw new Error("Telegram initData has expired.");
  }

  const rawUser = params.get("user");

  if (!rawUser) {
    throw new Error("Telegram initData does not contain user payload.");
  }

  const parsedUser = telegramUserSchema.parse(JSON.parse(rawUser));

  return {
    telegramId: BigInt(parsedUser.id),
    username: parsedUser.username ?? null,
    firstName: parsedUser.first_name ?? null,
    lastName: parsedUser.last_name ?? null,
    languageCode: parsedUser.language_code ?? null,
    photoUrl: parsedUser.photo_url ?? null,
    telegramPremium: parsedUser.is_premium ?? false,
    allowsWriteToPm: parsedUser.allows_write_to_pm ?? false,
    telegramLevel: resolveTelegramLevel(parsedUser),
    startParam: readStartParam(params),
    authDate,
  };
};
