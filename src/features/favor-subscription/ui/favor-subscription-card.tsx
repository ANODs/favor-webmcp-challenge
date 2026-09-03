"use client";

import { ArrowRight, CalendarClock } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { MONTHLY_SUBSCRIPTION_DURATION } from "@/entities/subscription";
import { Button, FavorPlusLogo, SurfaceCard } from "@/shared/ui";

import { useFavorSubscriptionOffer } from "../model/use-favor-subscription-offer";

type Props = {
  isPremium: boolean;
  premiumExpiresAt?: string | null;
  onOpen: () => void;
};

export function FavorSubscriptionCard({
  isPremium,
  premiumExpiresAt,
  onOpen,
}: Props) {
  const t = useTranslations("FavorSubscription");
  const locale = useLocale();
  const offerQuery = useFavorSubscriptionOffer(true);
  const monthlyPlan = offerQuery.data?.plans.find(
    (plan) => plan.duration === MONTHLY_SUBSCRIPTION_DURATION,
  );
  const premiumExpirationDate = premiumExpiresAt
    ? new Date(premiumExpiresAt)
    : null;
  const formattedPremiumExpirationDate =
    premiumExpirationDate && !Number.isNaN(premiumExpirationDate.getTime())
      ? new Intl.DateTimeFormat(locale, {
          day: "numeric",
          month: "long",
          year: "numeric",
        }).format(premiumExpirationDate)
      : null;
  const subscriptionStatus =
    isPremium && formattedPremiumExpirationDate
      ? t("SubscriptionActiveUntil", {
          date: formattedPremiumExpirationDate,
        })
      : isPremium
        ? t("SubscriptionActive")
        : t("SubscriptionInactive");

  return (
    <SurfaceCard className="flex min-h-full flex-col" paddingClassName="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
            {t("SubscriptionEyebrow")}
          </p>
          <h2 className="mt-2 text-xl font-bold text-[var(--foreground)]">
            {t("SubscriptionTitle")}
          </h2>
        </div>
        <FavorPlusLogo size={36} />
      </div>

      <div className="mt-5 rounded-3xl bg-[var(--surface-muted)] p-4">
        {offerQuery.isPending ? (
          <div className="h-9 w-32 animate-pulse rounded-xl bg-[var(--border-soft)]" />
        ) : monthlyPlan ? (
          <p className="text-3xl font-semibold text-[var(--foreground)]">
            {t("Stars", { price: monthlyPlan.telegramStars.amount })}
          </p>
        ) : (
          <p className="text-sm text-[var(--muted-foreground)]">
            {t("OfferLoadError")}
          </p>
        )}
        <div className="mt-3 flex items-center gap-2 text-sm font-medium text-[var(--foreground)]">
          <CalendarClock className="h-4 w-4 text-brand-accent-ink dark:text-brand-accent" />
          <span>{subscriptionStatus}</span>
        </div>

        {!isPremium && offerQuery.data?.favorRate ? (
          <p className="mt-3 border-t border-[var(--border-soft)] pt-3 text-xs leading-5 text-[var(--muted-foreground)]">
            {t("FavorOfferDetail", {
              favor: offerQuery.data.favorRate.favorAmount.toLocaleString(
                locale,
              ),
              ton: offerQuery.data.favorRate.discountedPriceTon.toFixed(1),
            })}
          </p>
        ) : null}
      </div>

      <Button
        type="button"
        variant="accent"
        size="lg"
        shape="rounded-full"
        fullWidth
        className="mt-auto min-h-11 translate-y-2"
        onClick={onOpen}
      >
        {isPremium ? t("ExtendSubscriptionAction") : t("BuySubscriptionAction")}
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Button>
    </SurfaceCard>
  );
}
