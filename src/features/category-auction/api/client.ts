import { apiRequest } from "@/shared/api";

export type CategoryAuctionDto = {
  id: number;
  categoryKey: string;
  categoryName: string;
  status: "open" | "awaiting_payment" | "settled" | "cancelled";
  biddingEndsAt: string;
  paymentDeadlineAt: string | null;
  currentCandidateBidId: number | null;
  bids: Array<{
    id: number;
    userId: number;
    amountNano: string;
    status: "active" | "awaiting_payment" | "payment_failed" | "winner";
    placedAt: string;
    user: {
      name: string | null;
      telegramUsername: string | null;
      avatarUrl: string | null;
    };
  }>;
};

export type AuctionStateDto = {
  auction: CategoryAuctionDto | null;
  currentUserId: number | null;
  startAmountNano: string;
  startTargetUsdt: number;
  favorPriceUsdt: number;
  premiumFreeAvailable: boolean;
  participatingAuctionId: number | null;
  categoryPromotionEndsAt: string | null;
  currentUserPaymentAttempts: number;
};

export const categoryAuctionClient = {
  getState: (categoryName: string) =>
    apiRequest<AuctionStateDto>({ path: `/api/category-auctions?category=${encodeURIComponent(categoryName)}` }),
  getFavorBalance: (ownerAddress: string) =>
    apiRequest<{ balanceNano: string; decimals: number }>({
      path: `/api/favor/balance?owner=${encodeURIComponent(ownerAddress)}`,
    }),
  start: (payload: {
    categoryName: string;
    amountNano?: string;
    userWalletAddress?: string;
    usePremiumFree: boolean;
  }) => apiRequest<{ auctionId: number }>({
    path: "/api/category-auctions",
    init: { method: "POST", body: JSON.stringify(payload) },
  }),
  bid: (auctionId: number, payload: { amountNano: string; userWalletAddress: string }) =>
    apiRequest<{ amountNano: string; biddingEndsAt: string }>({
      path: `/api/category-auctions/${auctionId}/bids`,
      init: { method: "POST", body: JSON.stringify(payload) },
    }),
  preparePayment: (auctionId: number, payload: { userWalletAddress: string }) =>
    apiRequest<{
      paymentIntentId: string;
      recipientAddress: string;
      userJettonWalletAddress: string;
      amountNano: string;
      reference: string;
      expiresAt: string;
      serverTime: number;
    }>({
      path: `/api/category-auctions/${auctionId}/payment/prepare`,
      init: { method: "POST", body: JSON.stringify(payload) },
    }),
  confirmPayment: (paymentIntentId: string, boc: string) =>
    apiRequest<{ confirmed: boolean; transactionHash: string | null; newlyConfirmed: boolean }>({
      path: `/api/favor-payments/${paymentIntentId}/confirm`,
      init: { method: "POST", body: JSON.stringify({ boc }) },
    }),
  assignPromotion: (promotionId: number, contractId: number | null) =>
    apiRequest({
      path: `/api/category-promotions/${promotionId}`,
      init: { method: "PATCH", body: JSON.stringify({ contractId }) },
    }),
};
