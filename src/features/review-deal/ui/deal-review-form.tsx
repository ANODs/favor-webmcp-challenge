"use client";

import { useTranslations } from "next-intl";

import { RatingStars, SurfaceCard } from "@/shared/ui";

type Props = {
  reviewRating: string;
  reviewComment: string;
  isPending?: boolean;
  isUpdate?: boolean;
  compact?: boolean;
  onRatingChange: (value: string) => void;
  onCommentChange: (value: string) => void;
  onSubmit: () => void;
};

export function DealReviewForm({
  reviewRating,
  reviewComment,
  isPending = false,
  isUpdate = false,
  compact = false,
  onRatingChange,
  onCommentChange,
  onSubmit,
}: Props) {
  const t = useTranslations("DealDetails");

  return (
    <SurfaceCard
      className={compact ? "rounded-[1.5rem]" : "rounded-[2rem]"}
      paddingClassName={compact ? "p-3.5" : "p-4 sm:p-6"}
    >
      <h3
        className={`${compact ? "text-[15px]" : "text-lg"} font-extrabold tracking-[-0.02em] text-zinc-950`}
      >
        {t("final_review")}
      </h3>

      <div className={`${compact ? "mt-3 gap-2.5" : "mt-4 gap-3"} grid`}>
        <label className="grid gap-2 text-sm font-medium text-zinc-900">
          {t("rating")}
          <div
            className={`${compact ? "px-3 py-2.5" : "px-4 py-3"} rounded-2xl border border-zinc-200 bg-zinc-50 dark:border-white/12`}
          >
            <RatingStars value={Number(reviewRating)} size="sm" />
            <select
              value={reviewRating}
              onChange={(event) => onRatingChange(event.target.value)}
              disabled={isPending}
              className={`${compact ? "mt-2 px-3 py-2 text-xs" : "mt-3 px-4 py-3 text-sm"} w-full rounded-xl border border-zinc-200 bg-transparent outline-none transition focus:border-zinc-900 disabled:bg-zinc-100 dark:border-white/12`}
            >
              <option value="5">{t("stars_5")}</option>
              <option value="4">{t("stars_4")}</option>
              <option value="3">{t("stars_3")}</option>
              <option value="2">{t("stars_2")}</option>
              <option value="1">{t("stars_1")}</option>
            </select>
          </div>
        </label>

        <label className="grid gap-2 text-sm font-medium text-zinc-900">
          {t("comment")}
          <textarea
            value={reviewComment}
            onChange={(event) => onCommentChange(event.target.value)}
            rows={compact ? 4 : 5}
            disabled={isPending}
            placeholder={t("review_placeholder")}
            className={`${compact ? "px-3 py-2.5 text-xs leading-5" : "px-4 py-3 text-sm"} rounded-2xl border border-zinc-200 bg-zinc-50 outline-none transition focus:border-zinc-900 disabled:bg-zinc-100 dark:border-white/12`}
          />
        </label>
      </div>

      <button
        type="button"
        onClick={onSubmit}
        disabled={isPending}
        className={`${compact ? "mt-3 py-2.5 text-xs" : "mt-4 py-3 text-sm"} w-full rounded-full bg-zinc-950 px-4 font-bold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300 dark:bg-white dark:text-zinc-950`}
      >
        {isPending ? t("review_saving") : isUpdate ? t("review_update") : t("review_leave")}
      </button>
    </SurfaceCard>
  );
}
