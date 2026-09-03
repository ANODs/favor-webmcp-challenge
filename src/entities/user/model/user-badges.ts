export const USER_BADGE_ICON_KEYS = [
  "sparkles",
  "award",
  "shield",
  "star",
  "heart",
  "zap",
  "rocket",
  "crown",
] as const;

export type UserBadgeIconKey = (typeof USER_BADGE_ICON_KEYS)[number];

export const USER_BADGE_TONES = [
  "brand-accent",
  "brand-blue",
  "brand-pink",
  "default",
] as const;

export type UserBadgeTone = (typeof USER_BADGE_TONES)[number];

export const USER_BADGE_CATALOG_PAGE_SIZE = 24;

const INVALID_CURSOR_MESSAGE = "INVALID_USER_BADGE_CATALOG_CURSOR";
const CANONICAL_INTEGER_PATTERN = /^-?(?:0|[1-9]\d*)$/;
const CANONICAL_POSITIVE_INTEGER_PATTERN = /^[1-9]\d*$/;

export const isUserBadgeIconKey = (
  value: string,
): value is UserBadgeIconKey =>
  USER_BADGE_ICON_KEYS.some((iconKey) => iconKey === value);

export const isUserBadgeTone = (value: string): value is UserBadgeTone =>
  USER_BADGE_TONES.some((tone) => tone === value);

export function parseUserBadgeCatalogCursor(rawCursor: string | null) {
  if (!rawCursor) {
    return undefined;
  }

  const [version, rawSortOrder, rawId, ...extraParts] = rawCursor.split(".");
  const sortOrder = Number(rawSortOrder);
  const id = Number(rawId);

  if (
    version !== "v1" ||
    extraParts.length > 0 ||
    !rawSortOrder ||
    !CANONICAL_INTEGER_PATTERN.test(rawSortOrder) ||
    String(sortOrder) !== rawSortOrder ||
    !Number.isSafeInteger(sortOrder) ||
    !rawId ||
    !CANONICAL_POSITIVE_INTEGER_PATTERN.test(rawId) ||
    String(id) !== rawId ||
    !Number.isSafeInteger(id)
  ) {
    throw new Error(INVALID_CURSOR_MESSAGE);
  }

  return { sortOrder, id };
}

export function paginateUserBadgeCatalog<
  TItem extends { id: number; sortOrder: number },
>(records: TItem[]) {
  const items = records.slice(0, USER_BADGE_CATALOG_PAGE_SIZE);
  const lastItem = items.at(-1);

  return {
    items,
    nextCursor:
      records.length > USER_BADGE_CATALOG_PAGE_SIZE && lastItem
        ? `v1.${lastItem.sortOrder}.${lastItem.id}`
        : null,
  };
}
