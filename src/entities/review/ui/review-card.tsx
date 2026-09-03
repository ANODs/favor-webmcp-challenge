import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import { formatDateTime } from "@/shared/lib/format";
import { RatingStars } from "@/shared/ui";

import type { ReviewDto } from "../api/dto";

type Props = {
  review: ReviewDto;
  className?: string;
  id?: string;
  footer?: ReactNode;
  title?: string;
  locale?: string;
  timeZone?: string;
};

export function ReviewCard({
  review,
  className,
  id,
  footer,
  title,
  locale,
  timeZone,
}: Props) {
  const t = useTranslations("Reviews");
  const reviewerName = review.reviewer?.name ?? t("UnknownUser");
  const reviewerUsername = review.reviewer?.telegramUsername
    ? `@${review.reviewer.telegramUsername}`
    : t("NoUsername");

  return (
    <article
      id={id}
      className={`rounded-3xl border border-zinc-200/80 bg-zinc-50 p-4 dark:border-white/10 sm:p-5 ${className ?? ""}`}
    >
      {title ? (
        <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
          {title}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-base font-bold text-zinc-950">{reviewerName}</p>
          <p className="mt-1 text-sm text-zinc-500">{reviewerUsername}</p>
        </div>
        <div className="flex w-max shrink-0 flex-col items-end gap-1 text-right">
          <RatingStars value={review.rating} size="sm" />
          <p className="whitespace-nowrap text-xs text-zinc-500">
            {formatDateTime(review.createdAt, locale, timeZone)}
          </p>
        </div>
      </div>

      <p className="mt-4 text-sm leading-6 text-zinc-700 sm:text-base">
        {review.comment?.trim() || t("NoComment")}
      </p>

      {footer ? <div className="mt-3">{footer}</div> : null}
    </article>
  );
}
