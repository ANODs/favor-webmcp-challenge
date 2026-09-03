import englishFormatCopy from "@/shared/locales/format.en.json";
import russianFormatCopy from "@/shared/locales/format.ru.json";

const getFormatCopy = (locale: string) =>
  locale.toLowerCase().startsWith("en")
    ? englishFormatCopy
    : russianFormatCopy;

export const formatCurrency = (value?: number | string | null, locale: string = "ru-RU") => {
  if (value === null || value === undefined || value === "") {
    return getFormatCopy(locale).notSpecified;
  }

  const amount = typeof value === "string" ? Number(value) : value;

  if (Number.isNaN(amount)) {
    return String(value);
  }

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(amount);
};

export const formatDateTime = (
  value?: string | null,
  locale: string = "ru-RU",
  timeZone?: string,
) => {
  if (!value) {
    return getFormatCopy(locale).notSpecified;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return getFormatCopy(locale).notSpecified;
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(date);
};

export const formatCompactDate = (value?: string | null, locale: string = "ru-RU") => {
  if (!value) {
    return getFormatCopy(locale).notSpecified;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return getFormatCopy(locale).notSpecified;
  }

  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
  }).format(date);
};

export function normalizeMediaRefs(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

export function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

export function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength).trimEnd()}...`;
}

export function formatTimeRemaining(
  targetDate?: string | Date | null,
  locale: string = "ru",
  now = Date.now(),
): string {
  const copy = getFormatCopy(locale);

  if (!targetDate) {
    return copy.notSpecified;
  }

  const target = new Date(targetDate).getTime();
  if (Number.isNaN(target)) {
    return copy.notSpecified;
  }

  const diffMs = target - now;
  if (diffMs <= 0) {
    return copy.expiredOverdue;
  }

  const totalMinutes = Math.ceil(diffMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  if (days > 0) {
    return `${days}${copy.dayShort} ${remainingHours}${copy.hourShort}`;
  }

  if (hours > 0) {
    return `${hours}${copy.hourShort} ${minutes}${copy.minuteShort}`;
  }

  return `${minutes}${copy.minuteShort}`;
}

export function formatDurationMinutes(durationMinutes?: number | null, locale: string = "ru"): string {
  const copy = getFormatCopy(locale);

  if (durationMinutes === null || durationMinutes === undefined || durationMinutes < 0) {
    return copy.notSpecified;
  }

  const days = Math.floor(durationMinutes / (24 * 60));
  const hours = Math.floor((durationMinutes % (24 * 60)) / 60);
  const minutes = durationMinutes % 60;

  const parts: string[] = [];
  if (days > 0) {
    parts.push(`${days}${copy.dayShort}`);
  }
  if (hours > 0) {
    parts.push(`${hours}${copy.hourShort}`);
  }
  if (minutes > 0 || parts.length === 0) {
    parts.push(`${minutes}${copy.minuteShort}`);
  }

  return parts.join(" ");
}
