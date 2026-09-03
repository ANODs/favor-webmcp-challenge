import { prisma } from "@/shared/lib/prisma";

export type TelegramMessageLocale = "ru" | "en";

export function normalizeTelegramMessageLocale(
  value: string | null | undefined,
): TelegramMessageLocale | null {
  const normalized = value?.trim().toLowerCase();

  if (normalized === "ru" || normalized?.startsWith("ru-")) {
    return "ru";
  }

  if (normalized === "en" || normalized?.startsWith("en-")) {
    return "en";
  }

  return null;
}

export async function resolveTelegramMessageLocale({
  telegramId,
  telegramLanguageCode,
  fallbackLocale = "ru",
}: {
  telegramId: bigint;
  telegramLanguageCode?: string | null;
  fallbackLocale?: TelegramMessageLocale;
}): Promise<TelegramMessageLocale> {
  const user = await prisma.user.findUnique({
    where: { telegramId },
    select: { languageCode: true },
  });

  return (
    normalizeTelegramMessageLocale(user?.languageCode) ??
    normalizeTelegramMessageLocale(telegramLanguageCode) ??
    fallbackLocale
  );
}
