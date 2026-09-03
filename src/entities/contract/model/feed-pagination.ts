export const CONTRACT_FEED_PAGE_SIZE = 6;

const INVALID_CURSOR_MESSAGE = "INVALID_CONTRACT_FEED_CURSOR";

export function parseContractFeedCursor(rawCursor: string | null) {
  if (!rawCursor) {
    return undefined;
  }

  const cursor = Number(rawCursor);

  if (!Number.isSafeInteger(cursor) || cursor <= 0) {
    throw new Error(INVALID_CURSOR_MESSAGE);
  }

  return cursor;
}

export function paginateContractFeed<TItem extends { id: number }>(
  items: TItem[],
  cursor?: number,
) {
  const cursorIndex = cursor === undefined
    ? -1
    : items.findIndex((item) => item.id === cursor);

  if (cursor !== undefined && cursorIndex === -1) {
    throw new Error(INVALID_CURSOR_MESSAGE);
  }

  const pageStart = cursorIndex + 1;
  const pageItems = items.slice(pageStart, pageStart + CONTRACT_FEED_PAGE_SIZE);
  const lastItem = pageItems.at(-1);
  const hasNextPage = pageStart + pageItems.length < items.length;

  return {
    items: pageItems,
    nextCursor: hasNextPage && lastItem ? String(lastItem.id) : null,
  };
}
