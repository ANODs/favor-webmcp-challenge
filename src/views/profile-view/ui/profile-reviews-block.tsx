"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";

import { routes } from "@/shared/config/routes";
import type { ProfileReviewItemDto } from "@/entities/user";
import { ReviewCard } from "@/entities/review";
import { ActionCard, ActionCardInset } from "@/shared/ui";

type Props = {
  reviews: ProfileReviewItemDto[];
  totalCount: number;
  isOwnProfile: boolean;
};

export function ProfileReviewsBlock({ reviews, totalCount, isOwnProfile }: Props) {
  const t = useTranslations("Profile");

  return (
    <ActionCard
      title={isOwnProfile ? t("ReviewsOwn") : t("ReviewsOther")}
      description={t("ReviewsCount", { count: totalCount })}
    >
      {reviews.length ? (
        <div className="grid gap-3">
          {reviews.map(({ deal, review }) => (
            <ReviewCard
              key={review.id}
              id={`review-${review.id}`}
              className="scroll-mt-24 rounded-3xl bg-zinc-50 p-4"
              review={review}
              footer={
                deal.contract?.slug ? (
                  <Link
                    href={routes.contractBySlug(deal.contract.slug)}
                    className="inline-flex text-sm font-medium text-zinc-700 transition hover:text-zinc-950"
                  >
                    {t("GoToContract")}
                  </Link>
                ) : null
              }
            />
          ))}
        </div>
      ) : (
        <ActionCardInset>{t("NoReviews")}</ActionCardInset>
      )}
    </ActionCard>
  );
}
