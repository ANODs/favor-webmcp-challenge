export const FAVOR_NANO = 1_000_000_000n;
export const AUCTION_BIDDING_DURATION_MS = 10 * 60 * 1000;
export const AUCTION_ANTI_SNIPING_MS = 60 * 1000;
export const AUCTION_PAYMENT_WINDOW_MS = 5 * 60 * 1000;
export const AUCTION_PROMOTION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
export const AUCTION_MAX_PAYMENT_ATTEMPTS = 2;

export const minimumNextBidNano = (leaderNano: bigint) =>
  (leaderNano * 110n + 99n) / 100n;

export const extendAuctionDeadline = (deadline: Date, bidAt: Date) =>
  deadline.getTime() - bidAt.getTime() < AUCTION_ANTI_SNIPING_MS
    ? new Date(bidAt.getTime() + AUCTION_ANTI_SNIPING_MS)
    : deadline;

export const auctionStartAmountNano = ({
  targetUsdt,
  favorPriceUsdt,
  maxFavor,
}: {
  targetUsdt: number;
  favorPriceUsdt: number;
  maxFavor: number;
}) => {
  if (!Number.isFinite(favorPriceUsdt) || favorPriceUsdt <= 0) {
    throw new Error("FAVOR_PRICE_UNAVAILABLE");
  }

  const favorAmount = Math.min(maxFavor, targetUsdt / favorPriceUsdt);
  return BigInt(Math.ceil(favorAmount * Number(FAVOR_NANO)));
};

export const promotionEndsAt = (startsAt: Date) =>
  new Date(startsAt.getTime() + AUCTION_PROMOTION_DURATION_MS);
