import {
  FAVOR_SUBSCRIPTION_DURATION,
  type SubscriptionOfferDto,
  type SubscriptionPaymentIntentStatus,
} from "@/entities/subscription";
import { apiRequest } from "@/shared/api";

import type { FavorSubscriptionDuration } from "../model/types";

type SubscriptionInvoiceDto = {
  recipientSubscriptionActive: boolean;
  paymentIntentId: string;
  recipientUserId: number;
  isGift: boolean;
  status: SubscriptionPaymentIntentStatus;
  expiresAt: string;
  invoiceLink: string | null;
};

type TonSubscriptionPreparationDto = {
  recipientSubscriptionActive: boolean;
  paymentIntentId: string;
  recipientUserId: number;
  isGift: boolean;
  status: SubscriptionPaymentIntentStatus;
  expiresAt: string;
  recipientAddress: string | null;
  amountNano: string | null;
  reference: string | null;
  serverTime?: number;
};

type SubscriptionActivationDto = {
  activated: boolean;
  newlyConfirmed: boolean;
  recipientUserId: number;
  isGift: boolean;
  premiumExpiresAt: string;
  transactionHash: string | null;
};

type SubscriptionIntentStatusDto = {
  paymentIntentId: string;
  status: SubscriptionPaymentIntentStatus;
  activated: boolean;
  terminal: boolean;
  recipientUserId: number;
  isGift: boolean;
  duration: FavorSubscriptionDuration;
  provider: string;
  asset: string;
  startsAt: string | null;
  premiumExpiresAt: string | null;
  transactionHash: string | null;
  confirmedAt: string | null;
  expiresAt: string;
  serverTime: string;
};

type SubscriptionReconciliationDto = {
  paymentIntentId: string;
  status: SubscriptionPaymentIntentStatus;
  activated: boolean;
  terminal: boolean;
  recipientUserId: number;
  newlyConfirmed?: boolean;
  isGift?: boolean;
  premiumExpiresAt?: string;
  transactionHash?: string | null;
  serverTime: string;
};

export const subscriptionClient = {
  getOffer() {
    return apiRequest<SubscriptionOfferDto>({
      path: "/api/subscription/offer",
    });
  },
  getIntentStatus(paymentIntentId: string) {
    return apiRequest<SubscriptionIntentStatusDto>({
      path: `/api/subscription/intents/${encodeURIComponent(paymentIntentId)}`,
    });
  },
  cancelIntent(paymentIntentId: string) {
    return apiRequest<{
      canceled: boolean;
      status: SubscriptionPaymentIntentStatus;
    }>({
      path: `/api/subscription/intents/${encodeURIComponent(paymentIntentId)}`,
      init: { method: "DELETE" },
    });
  },
  reconcileIntent(paymentIntentId: string) {
    return apiRequest<SubscriptionReconciliationDto>({
      path: `/api/subscription/intents/${encodeURIComponent(paymentIntentId)}/reconcile`,
      init: { method: "POST" },
    });
  },
  createInvoice(payload: {
    duration: FavorSubscriptionDuration;
    locale: "ru" | "en";
    recipientUserId: number;
    checkoutAttemptId: string;
  }) {
    return apiRequest<SubscriptionInvoiceDto>({
      path: "/api/subscription/invoice",
      init: {
        method: "POST",
        body: JSON.stringify(payload),
      },
    });
  },
  prepareTonPayment(payload: {
    duration: FavorSubscriptionDuration;
    expectedAmountNano: string;
    userWalletAddress: string;
    recipientUserId: number;
    checkoutAttemptId: string;
  }) {
    return apiRequest<TonSubscriptionPreparationDto>({
      path: "/api/subscription/ton/prepare",
      init: {
        method: "POST",
        body: JSON.stringify(payload),
      },
    });
  },
  confirmTonPayment(payload: { paymentIntentId: string; boc: string; reference: string }) {
    return apiRequest<SubscriptionActivationDto>({
      path: "/api/subscription/ton/confirm",
      init: {
        method: "POST",
        body: JSON.stringify(payload),
      },
    });
  },
  prepareFavorPayment(payload: {
    duration: typeof FAVOR_SUBSCRIPTION_DURATION;
    expectedAmountNano: string;
    userWalletAddress: string;
    recipientUserId: number;
    checkoutAttemptId: string;
  }) {
    return apiRequest<{
      recipientSubscriptionActive: boolean;
      paymentIntentId: string;
      recipientUserId: number;
      isGift: boolean;
      status: SubscriptionPaymentIntentStatus;
      expiresAt: string;
      recipientAddress: string | null;
      userJettonWalletAddress: string | null;
      amountNano: string | null;
      reference: string | null;
      favorPriceUsdt: number | null;
      serverTime?: number;
    }>({
      path: "/api/subscription/favor/prepare",
      init: {
        method: "POST",
        body: JSON.stringify(payload),
      },
    });
  },
  confirmFavorPayment(payload: { paymentIntentId: string; boc: string }) {
    return apiRequest<SubscriptionActivationDto>({
      path: "/api/subscription/favor/confirm",
      init: {
        method: "POST",
        body: JSON.stringify(payload),
      },
    });
  },
};

