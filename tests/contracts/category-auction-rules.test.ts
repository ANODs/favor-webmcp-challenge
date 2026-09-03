import assert from "node:assert/strict";
import test from "node:test";

import {
  AUCTION_ANTI_SNIPING_MS,
  auctionStartAmountNano,
  extendAuctionDeadline,
  minimumNextBidNano,
  promotionEndsAt,
} from "../../src/features/category-auction/model/rules";
import {
  isCategoryAuctionRealtimeEvent,
  isCategoryAuctionRealtimeStatus,
} from "../../src/features/category-auction/model/realtime";

test("a bid must be at least ten percent above the current leader", () => {
  assert.equal(minimumNextBidNano(100_000_000_000n), 110_000_000_000n);
  assert.equal(minimumNextBidNano(1n), 2n);
});

test("anti-sniping only restores the remaining window to one minute", () => {
  const bidAt = new Date("2026-08-06T12:00:00.000Z");
  const longDeadline = new Date(bidAt.getTime() + AUCTION_ANTI_SNIPING_MS + 1);
  const shortDeadline = new Date(bidAt.getTime() + 10_000);

  assert.equal(extendAuctionDeadline(longDeadline, bidAt).getTime(), longDeadline.getTime());
  assert.equal(
    extendAuctionDeadline(shortDeadline, bidAt).getTime(),
    bidAt.getTime() + AUCTION_ANTI_SNIPING_MS,
  );
});

test("dynamic starting bid has no lower FAVOR floor and is capped at 100 FAVOR", () => {
  assert.equal(
    auctionStartAmountNano({ targetUsdt: 0.1, favorPriceUsdt: 1, maxFavor: 100 }),
    100_000_000n,
  );
  assert.equal(
    auctionStartAmountNano({ targetUsdt: 0.1, favorPriceUsdt: 0.000001, maxFavor: 100 }),
    100_000_000_000n,
  );
});

test("promotion lasts exactly seven days from settlement", () => {
  const settledAt = new Date("2026-08-06T12:00:00.000Z");
  assert.equal(
    promotionEndsAt(settledAt).toISOString(),
    "2026-08-13T12:00:00.000Z",
  );
});

test("category auction realtime accepts only complete update events", () => {
  assert.equal(isCategoryAuctionRealtimeEvent({
    type: "category_auction.updated",
    categoryKey: "web development",
    auctionId: 42,
    reason: "bid:update",
    occurredAt: "2026-08-06T19:00:00.000Z",
  }), true);
  assert.equal(isCategoryAuctionRealtimeEvent({
    type: "category_auction.realtime_status",
    categoryKey: "web development",
  }), false);
  assert.equal(isCategoryAuctionRealtimeStatus({
    type: "category_auction.realtime_status",
    available: true,
    changedAt: "2026-08-06T19:00:00.000Z",
  }), true);
});
