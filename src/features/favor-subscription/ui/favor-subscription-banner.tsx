"use client";

import { ArrowRight, Gift, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button, FavorPlusLogo, SurfaceCard } from "@/shared/ui";

import {
  getFavorSubscriptionMode,
  type FavorSubscriptionTarget,
} from "../model/types";

type Props = {
  payerUserId: number | null;
  target: FavorSubscriptionTarget;
  onOpen: () => void;
};

export function FavorSubscriptionBanner({
  payerUserId,
  target,
  onOpen,
}: Props) {
  const t = useTranslations("FavorSubscription");
  const mode = getFavorSubscriptionMode(payerUserId, target.id);
  const isGift = mode === "gift";

  return (
    <SurfaceCard
      className="overflow-hidden border-brand-accent/25 bg-[linear-gradient(135deg,var(--surface),color-mix(in_srgb,var(--color-brand-accent)_10%,var(--surface)))]"
      paddingClassName="p-4 sm:p-5"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3 sm:items-center">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-accent/15 text-brand-accent-ink dark:text-brand-accent">
            {isGift ? (
              <Gift className="h-6 w-6" aria-hidden="true" />
            ) : (
              <Sparkles className="h-6 w-6" aria-hidden="true" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-[var(--foreground)]">
                {isGift ? t("GiftBannerTitle") : t("BuyBannerTitle")}
              </h2>
              <FavorPlusLogo size={22} />
            </div>
            <p className="mt-1 [overflow-wrap:anywhere] text-sm leading-6 text-[var(--muted-foreground)]">
              {isGift
                ? t("GiftBannerDesc", { name: target.displayName })
                : t("BuyBannerDesc")}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="accent"
          size="md"
          shape="rounded-full"
          className="min-h-11 shrink-0"
          onClick={onOpen}
        >
          {isGift ? t("GiftSubscriptionAction") : t("BuySubscriptionAction")}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </SurfaceCard>
  );
}
