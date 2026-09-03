export const MODERATED_USERS_PAGE_SIZE = 20;

const INVALID_CURSOR_MESSAGE = "INVALID_MODERATED_USERS_CURSOR";

export function parseModeratedUsersCursor(rawCursor: string | null) {
  if (!rawCursor) {
    return undefined;
  }

  const [version, rawCreatedAt, rawId, ...extraParts] = rawCursor.split(".");
  const createdAtTimestamp = Number(rawCreatedAt);
  const id = Number(rawId);

  if (
    version !== "v1" ||
    extraParts.length > 0 ||
    !Number.isSafeInteger(createdAtTimestamp) ||
    createdAtTimestamp <= 0 ||
    !Number.isSafeInteger(id) ||
    id <= 0
  ) {
    throw new Error(INVALID_CURSOR_MESSAGE);
  }

  return {
    createdAt: new Date(createdAtTimestamp),
    id,
  };
}

export function paginateModeratedUsers<
  TItem extends { id: number; createdAt: Date | string },
>(
  records: TItem[],
) {
  const items = records.slice(0, MODERATED_USERS_PAGE_SIZE);
  const lastItem = items.at(-1);

  return {
    items,
    nextCursor:
      records.length > MODERATED_USERS_PAGE_SIZE && lastItem
        ? `v1.${new Date(lastItem.createdAt).getTime()}.${lastItem.id}`
        : null,
  };
}
