export const CATEGORY_AUCTION_UPDATED_EVENT = "category_auction.updated" as const;

export type CategoryAuctionRealtimeEvent = {
  type: typeof CATEGORY_AUCTION_UPDATED_EVENT;
  categoryKey: string;
  auctionId: number;
  reason: string;
  occurredAt: string;
};

export type CategoryAuctionRealtimeStatus = {
  type: "category_auction.realtime_status";
  available: boolean;
  changedAt: string;
};

export const isCategoryAuctionRealtimeEvent = (
  value: unknown,
): value is CategoryAuctionRealtimeEvent => {
  if (!value || typeof value !== "object") return false;
  const event = value as Partial<CategoryAuctionRealtimeEvent>;
  return event.type === CATEGORY_AUCTION_UPDATED_EVENT &&
    typeof event.categoryKey === "string" &&
    Number.isInteger(event.auctionId) &&
    typeof event.reason === "string" &&
    typeof event.occurredAt === "string";
};

export const isCategoryAuctionRealtimeStatus = (
  value: unknown,
): value is CategoryAuctionRealtimeStatus => {
  if (!value || typeof value !== "object") return false;
  const status = value as Partial<CategoryAuctionRealtimeStatus>;
  return status.type === "category_auction.realtime_status" &&
    typeof status.available === "boolean" &&
    typeof status.changedAt === "string";
};
