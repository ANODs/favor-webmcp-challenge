"use client";

import { useSyncExternalStore } from "react";

import type { FavorSubscriptionTarget } from "./types";

const PENDING_SUBSCRIPTION_STORAGE_KEY = "favor_pending_subscription";
const PENDING_SUBSCRIPTION_CHANGED_EVENT =
  "favor:pending-subscription-change";
const PENDING_SUBSCRIPTION_VERSION = 3;

type PendingSubscriptionRecipient = Pick<
  FavorSubscriptionTarget,
  "id" | "slug" | "displayName"
>;

type PendingFavorSubscriptionBase = {
  version: typeof PENDING_SUBSCRIPTION_VERSION;
  payerUserId: number;
  recipient: PendingSubscriptionRecipient;
  checkoutAttemptId: string;
  paymentIntentId: string;
  expiresAt: string;
  createdAt: number;
};

export type PendingFavorSubscription = PendingFavorSubscriptionBase &
  (
    | {
        provider: "stars";
      }
    | {
        provider: "favor" | "ton";
        reference: string;
        boc?: string;
      }
  );

type PendingFavorSubscriptionInputBase = Omit<
  PendingFavorSubscriptionBase,
  "version" | "createdAt"
>;

export type PendingFavorSubscriptionInput =
  PendingFavorSubscriptionInputBase &
    (
      | {
          provider: "stars";
        }
      | {
          provider: "favor" | "ton";
          reference: string;
          boc?: string;
        }
    );

let cachedRawValue: string | null | undefined;
let cachedPendingSubscription: PendingFavorSubscription | null = null;

const isPendingFavorSubscription = (
  value: unknown,
): value is PendingFavorSubscription => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  const recipient = candidate.recipient as
    | Partial<PendingSubscriptionRecipient>
    | undefined;
  const provider = candidate.provider;
  const hasValidProvider =
    provider === "stars" || provider === "favor" || provider === "ton";
  const hasValidProviderFields =
    provider === "stars" ||
    ((provider === "favor" || provider === "ton") &&
      typeof candidate.reference === "string" &&
      (candidate.boc === undefined || typeof candidate.boc === "string"));

  return (
    candidate.version === PENDING_SUBSCRIPTION_VERSION &&
    hasValidProvider &&
    hasValidProviderFields &&
    Number.isSafeInteger(candidate.payerUserId) &&
    Boolean(recipient) &&
    Number.isSafeInteger(recipient?.id) &&
    typeof recipient?.slug === "string" &&
    typeof recipient?.displayName === "string" &&
    typeof candidate.checkoutAttemptId === "string" &&
    typeof candidate.paymentIntentId === "string" &&
    typeof candidate.expiresAt === "string" &&
    Number.isFinite(Date.parse(candidate.expiresAt)) &&
    typeof candidate.createdAt === "number"
  );
};

const resetPendingSubscriptionCache = () => {
  cachedRawValue = undefined;
  cachedPendingSubscription = null;
};

const notifyPendingSubscriptionChanged = () => {
  window.dispatchEvent(new Event(PENDING_SUBSCRIPTION_CHANGED_EVENT));
};

export const getPendingFavorSubscription = (): PendingFavorSubscription | null => {
  if (typeof window === "undefined") return null;

  try {
    const rawValue = window.localStorage.getItem(
      PENDING_SUBSCRIPTION_STORAGE_KEY,
    );

    if (rawValue === cachedRawValue && cachedPendingSubscription) {
      return cachedPendingSubscription;
    }
    if (rawValue === cachedRawValue) {
      return null;
    }

    if (!rawValue) {
      cachedRawValue = null;
      cachedPendingSubscription = null;
      return null;
    }

    const parsedValue: unknown = JSON.parse(rawValue);
    if (!isPendingFavorSubscription(parsedValue)) {
      window.localStorage.removeItem(PENDING_SUBSCRIPTION_STORAGE_KEY);
      cachedRawValue = null;
      cachedPendingSubscription = null;
      return null;
    }

    cachedRawValue = rawValue;
    cachedPendingSubscription = parsedValue;
    return parsedValue;
  } catch {
    resetPendingSubscriptionCache();
    return null;
  }
};

export const savePendingFavorSubscription = (
  pending: PendingFavorSubscriptionInput,
) => {
  if (typeof window === "undefined") return false;

  try {
    const value = {
      ...pending,
      version: PENDING_SUBSCRIPTION_VERSION,
      createdAt: Date.now(),
    } satisfies PendingFavorSubscription;
    const serializedValue = JSON.stringify(value);

    window.localStorage.setItem(
      PENDING_SUBSCRIPTION_STORAGE_KEY,
      serializedValue,
    );
    cachedRawValue = serializedValue;
    cachedPendingSubscription = value;
    notifyPendingSubscriptionChanged();
    return true;
  } catch (error) {
    console.warn(
      "Failed to persist a pending Favor subscription checkout",
      error,
    );
    return false;
  }
};

export const clearPendingFavorSubscription = (paymentIntentId?: string) => {
  if (typeof window === "undefined") return;

  try {
    if (paymentIntentId) {
      const pending = getPendingFavorSubscription();
      if (pending && pending.paymentIntentId !== paymentIntentId) return;
    }

    window.localStorage.removeItem(PENDING_SUBSCRIPTION_STORAGE_KEY);
    cachedRawValue = null;
    cachedPendingSubscription = null;
    notifyPendingSubscriptionChanged();
  } catch {
    // Storage failures must not turn a confirmed payment into a UI error.
  }
};

const subscribePendingFavorSubscription = (onChange: () => void) => {
  const handleLocalChange = () => onChange();
  const handleStorageChange = (event: StorageEvent) => {
    if (event.key !== PENDING_SUBSCRIPTION_STORAGE_KEY) return;

    resetPendingSubscriptionCache();
    onChange();
  };

  window.addEventListener(
    PENDING_SUBSCRIPTION_CHANGED_EVENT,
    handleLocalChange,
  );
  window.addEventListener("storage", handleStorageChange);

  return () => {
    window.removeEventListener(
      PENDING_SUBSCRIPTION_CHANGED_EVENT,
      handleLocalChange,
    );
    window.removeEventListener("storage", handleStorageChange);
  };
};

const getServerPendingFavorSubscription = () => null;

export const usePendingFavorSubscription = () =>
  useSyncExternalStore(
    subscribePendingFavorSubscription,
    getPendingFavorSubscription,
    getServerPendingFavorSubscription,
  );
