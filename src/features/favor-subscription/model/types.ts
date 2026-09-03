import type { SubscriptionDuration } from "@/entities/subscription";

export type FavorSubscriptionDuration = SubscriptionDuration;

export type FavorSubscriptionTarget = {
  id: number;
  slug: string;
  displayName: string;
  isPremium: boolean;
};

export type FavorSubscriptionMode = "self" | "gift";

export const getFavorSubscriptionMode = (
  payerUserId: number | null,
  recipientUserId: number,
): FavorSubscriptionMode =>
  payerUserId === recipientUserId ? "self" : "gift";
