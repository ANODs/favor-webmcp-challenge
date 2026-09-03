"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Unbounded } from "next/font/google";
import { useEffect, useState } from "react";

import { contractQueryKeys } from "@/entities/contract";
import {
  dealsClient,
  getAvailableDealTransitions,
  getDealCounterpart,
  getDealTimeStatus,
  getParticipantRole,
} from "@/entities/deal";
import { authClient, sessionQueryKeys } from "@/entities/session";
import {
  TELEGRAM_MINI_APP_START_PARAMS,
  buildTelegramMiniAppUrl,
  buildTelegramUserUrl,
} from "@/shared/lib/telegram";
import { ReviewCard } from "@/entities/review";
import { ConfirmationDialog, Skeleton, SurfaceCard } from "@/shared/ui";
import { formatDateTime, formatTimeRemaining } from "@/shared/lib/format";
import { DealStatusTimeline } from "@/widgets/deal-status-timeline";

import { DealHeader } from "./deal-header";
import { DealCommunicationBlock } from "./deal-communication-block";
import { DealActionsWidget } from "@/widgets/deal-actions";
import { DealReviewBlock } from "./deal-review-block";
import { DealPortfolioBlock } from "./deal-portfolio-block";
import { DealSettlementSummary } from "./deal-settlement-summary";
import { useLocale, useTranslations } from "next-intl";

type Props = {
  id: number;
  botUsername: string;
};

const unbounded = Unbounded({ subsets: ["latin", "cyrillic"] });

export function DealDetailsView({ id, botUsername }: Props) {
  const t = useTranslations("DealDetails");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [errorMessage, setErrorMessage] = useState("");
  const [reviewRatingDraft, setReviewRatingDraft] = useState<string | null>(null);
  const [reviewCommentDraft, setReviewCommentDraft] = useState<string | null>(null);
  const [reviewSuccessMessage, setReviewSuccessMessage] = useState("");
  const [hasDismissedPaymentNotice, setHasDismissedPaymentNotice] = useState(false);
  const [serverNow, setServerNow] = useState<number | null>(null);

  useEffect(() => {
    let isDisposed = false;
    let serverOffsetMs: number | null = null;

    const syncServerClock = async () => {
      const requestStartedAt = Date.now();

      try {
        const response = await fetch("/api/time", { cache: "no-store" });
        if (!response.ok) {
          return;
        }

        const payload = await response.json() as {
          serverTime?: number;
          serverTimeMs?: number;
        };
        const requestFinishedAt = Date.now();
        const remoteTimeMs =
          payload.serverTimeMs ??
          (payload.serverTime === undefined ? null : payload.serverTime * 1000);
        if (remoteTimeMs === null || !Number.isFinite(remoteTimeMs)) {
          return;
        }

        serverOffsetMs =
          remoteTimeMs - (requestStartedAt + requestFinishedAt) / 2;
        if (!isDisposed) {
          setServerNow(requestFinishedAt + serverOffsetMs);
        }
      } catch {
        // Keep deadline actions hidden until an authoritative server clock is available.
      }
    };

    void syncServerClock();
    const tickIntervalId = window.setInterval(() => {
      if (serverOffsetMs !== null) {
        setServerNow(Date.now() + serverOffsetMs);
      }
    }, 1_000);
    const syncIntervalId = window.setInterval(() => {
      void syncServerClock();
    }, 60_000);

    return () => {
      isDisposed = true;
      window.clearInterval(tickIntervalId);
      window.clearInterval(syncIntervalId);
    };
  }, []);

  const meQuery = useQuery({
    queryKey: sessionQueryKeys.currentUser,
    queryFn: authClient.getMe,
  });
  const dealQuery = useQuery({
    queryKey: ["deal", id],
    queryFn: () => dealsClient.getById(id),
    refetchInterval: (query) => {
      const status = query.state.data?.status;

      return status && ["completed", "cancelled", "rejected"].includes(status)
        ? false
        : 5_000;
    },
    refetchIntervalInBackground: true,
  });

  const transitionMutation = useMutation({
    mutationFn: (toStatus: NonNullable<ReturnType<typeof getAvailableDealTransitions>>[number]) =>
      dealsClient.transition(id, toStatus),
    onSuccess: async () => {
      setErrorMessage("");
      await queryClient.invalidateQueries({ queryKey: ["deal", id] });
      await queryClient.invalidateQueries({ queryKey: ["deals"] });
    },
    onError: () => {
      setErrorMessage(t("error_change_status"));
    },
  });

  const reviewMutation = useMutation({
    mutationFn: () =>
      dealsClient.review(id, {
        rating: Number(reviewRating),
        comment: reviewComment.trim() || null,
      }),
    onSuccess: async (updatedDeal) => {
      setErrorMessage("");
      setReviewSuccessMessage(
        updatedDeal.status === "completed"
          ? t("review_saved_completed")
          : t("review_saved_awaiting"),
      );
      await queryClient.invalidateQueries({ queryKey: ["deal", id] });
      await queryClient.invalidateQueries({ queryKey: ["deals"] });
      await queryClient.invalidateQueries({ queryKey: sessionQueryKeys.currentUser });
      if (updatedDeal.contract?.slug) {
        await queryClient.invalidateQueries({
          queryKey: contractQueryKeys.detail(updatedDeal.contract.slug),
        });
      }
    },
    onError: () => {
      setReviewSuccessMessage("");
      setErrorMessage(t("error_save_review"));
    },
  });

  const deal = dealQuery.data;
  const availableTransitions = deal
    ? getAvailableDealTransitions(deal, meQuery.data?.id ?? null)
    : [];
  const currentUserReview = deal?.reviews?.find(
    (review) => review.reviewerId === meQuery.data?.id,
  );
  const canReview =
    !!deal &&
    !!meQuery.data &&
    (deal.status === "awaiting_review" || deal.status === "completed");
  const reviewRating = reviewRatingDraft ?? String(currentUserReview?.rating ?? 5);
  const reviewComment = reviewCommentDraft ?? (currentUserReview?.comment ?? "");
  const role = deal ? getParticipantRole(deal, meQuery.data?.id ?? null) : null;
  const isCustomer = role === "customer";
  const counterpart = deal ? getDealCounterpart(deal, meQuery.data?.id ?? null) : null;
  const counterpartChatUrl = buildTelegramUserUrl({
    telegramUsername: counterpart?.telegramUsername,
    telegramId: counterpart?.telegramId ?? null,
  });
  const notificationsBotUrl = buildTelegramMiniAppUrl(
    botUsername,
    TELEGRAM_MINI_APP_START_PARAMS.deals,
  );
  const canOpenCounterpartChat = Boolean(counterpartChatUrl);
  const reviewsAverage = deal?.reviews?.length
    ? deal.reviews.reduce((sum, review) => sum + review.rating, 0) / deal.reviews.length
    : null;
  const hasCustomerDeadlineRefund = Boolean(
    deal &&
      isCustomer &&
      serverNow !== null &&
      deal.isEscrow &&
      (deal.escrowVersion ?? 1) >= 2 &&
      getDealTimeStatus(deal, serverNow).isOverdue,
  );
  const paymentWindowRemaining = deal?.paymentExpiresAt
    ? serverNow === null
      ? formatDateTime(
          deal.paymentExpiresAt,
          locale === "en" ? "en-US" : "ru-RU",
        )
      : formatTimeRemaining(deal.paymentExpiresAt, locale, serverNow)
    : "";

  return (
    <>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-6 pb-28 lg:pb-6">
        {dealQuery.isLoading ? (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="flex flex-col gap-4">
              <SurfaceCard paddingClassName="p-0" className="overflow-hidden rounded-[2rem]">
                <Skeleton className="h-72 w-full rounded-none sm:h-80" />
                <div className="space-y-4 p-4 sm:p-6">
                  <div className="flex gap-2">
                    <Skeleton className="h-7 w-24 rounded-full" />
                    <Skeleton className="h-7 w-28 rounded-full" />
                  </div>
                  <Skeleton className="h-3 w-2/5" />
                  <Skeleton className="h-9 w-3/4" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                  </div>
                  <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-zinc-200 dark:border-white/10">
                    {Array.from({ length: 2 }, (_, index) => (
                      <div key={index} className={index ? "border-l border-zinc-200 p-5 dark:border-white/10" : "p-5"}>
                        <Skeleton className="h-9 w-2/3" />
                        <Skeleton className="mt-2 h-3 w-4/5" />
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-zinc-200 dark:border-white/10">
                    {Array.from({ length: 4 }, (_, index) => (
                      <div
                        key={index}
                        className={`flex items-center gap-3 p-4 ${index % 2 ? "border-l border-zinc-200 dark:border-white/10" : ""} ${index > 1 ? "border-t border-zinc-200 dark:border-white/10" : ""}`}
                      >
                        <Skeleton className="h-5 w-5 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-2.5 w-16" />
                          <Skeleton className="h-3.5 w-24" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </SurfaceCard>
              <SurfaceCard className="h-64 rounded-[2rem]">
                <Skeleton className="mb-4 h-6 w-40" />
                <Skeleton className="mb-2 h-4 w-full" />
                <Skeleton className="mb-2 h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </SurfaceCard>
            </div>
            
            <div className="flex flex-col gap-4">
              <SurfaceCard className="rounded-[2rem]">
                <Skeleton className="mb-4 h-6 w-32" />
                <div className="flex flex-col gap-3">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              </SurfaceCard>
              <SurfaceCard className="rounded-[2rem]">
                <Skeleton className="mb-4 h-6 w-40" />
                <Skeleton className="h-24 w-full" />
              </SurfaceCard>
              <Skeleton className="h-12 w-full rounded-full" />
            </div>
          </div>
        ) : null}

        {dealQuery.isError ? (
          <SurfaceCard>
            <p className="text-sm text-red-700">
              {t("error_open_deal")}
            </p>
          </SurfaceCard>
        ) : null}

        {errorMessage ? (
          <SurfaceCard>
            <p className="text-sm text-red-700">{errorMessage}</p>
          </SurfaceCard>
        ) : null}

        {reviewSuccessMessage ? (
          <SurfaceCard>
            <p className="text-sm text-emerald-700">{reviewSuccessMessage}</p>
          </SurfaceCard>
        ) : null}

        {deal ? (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="flex flex-col gap-4">
              <DealHeader deal={deal} isCustomer={isCustomer} now={serverNow} />

              <DealCommunicationBlock
                deal={deal}
                isCustomer={isCustomer}
                notificationsBotUrl={notificationsBotUrl}
              />
            </div>

            <div className="flex flex-col gap-4">
              <DealStatusTimeline status={deal.status} isEscrow={deal.isEscrow} />

              {deal.isEscrow && ["awaiting_review", "completed"].includes(deal.status) ? (
                <DealSettlementSummary deal={deal} />
              ) : null}

              {!["awaiting_review", "completed"].includes(deal.status) ? (
                <DealActionsWidget
                  deal={deal}
                  me={meQuery.data}
                  refetch={async () => dealQuery.refetch()}
                  availableTransitions={availableTransitions}
                  transitionMutation={transitionMutation}
                  now={serverNow}
                />
              ) : null}

              <DealReviewBlock
                canReview={canReview}
                currentUserReview={currentUserReview}
                reviewRating={reviewRating}
                reviewComment={reviewComment}
                setReviewRatingDraft={setReviewRatingDraft}
                setReviewCommentDraft={setReviewCommentDraft}
                reviewMutation={reviewMutation}
              />

              <DealPortfolioBlock deal={deal} />

              <div className="hidden lg:block">
                <div className="theme-surface w-full rounded-full border p-1">
                  <button
                    type="button"
                    disabled={!canOpenCounterpartChat}
                    onClick={() => {
                      if (!counterpartChatUrl) {
                        return;
                      }

                      window.open(counterpartChatUrl, "_blank", "noopener,noreferrer");
                    }}
                    className="w-full rounded-full bg-zinc-950 px-5 py-4 text-sm font-semibold text-white shadow-lg transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-white/90"
                  >
                    {canOpenCounterpartChat ? t("go_to_chat") : t("chat_unavailable")}
                  </button>
                </div>
              </div>

              {deal?.reviews?.length ? (
                <SurfaceCard className="rounded-[2rem]" paddingClassName="p-4 sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3
                      className={`${unbounded.className} text-lg font-extrabold tracking-[-0.035em] text-zinc-950`}
                    >
                      {t("deal_reviews")}
                    </h3>
                    <p className="text-sm font-semibold text-zinc-600">
                      {t("reviews_summary", {
                        rating: reviewsAverage?.toFixed(1) ?? "0.0",
                        count: deal.reviews.length,
                      })}
                    </p>
                  </div>
                  <div className="mt-4 grid gap-3">
                    {deal.reviews.map((review) => (
                      <ReviewCard
                        key={review.id}
                        review={review}
                        title={
                          review.reviewerId === meQuery.data?.id
                            ? t("your_review")
                            : t("counterpart_review")
                        }
                      />
                    ))}
                  </div>
                </SurfaceCard>
              ) : null}
            </div>
          </div>
        ) : null}
      </main>

      {deal ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 p-4 lg:hidden">
          <div className="mx-auto flex w-full max-w-6xl justify-center xl:justify-end">
            <div className="theme-surface pointer-events-auto w-full max-w-md rounded-full border p-1 shadow-lg">
              {hasCustomerDeadlineRefund ? (
                <a
                  href="#deal-actions"
                  className="block w-full rounded-full bg-red-600 px-5 py-4 text-center text-sm font-bold text-white shadow-lg transition hover:bg-red-500"
                >
                  {t("refund_available")}
                </a>
              ) : (
                <button
                  type="button"
                  disabled={!canOpenCounterpartChat}
                  onClick={() => {
                    if (!counterpartChatUrl) {
                      return;
                    }

                    window.open(counterpartChatUrl, "_blank", "noopener,noreferrer");
                  }}
                  className="w-full rounded-full bg-zinc-950 px-5 py-4 text-sm font-semibold text-white shadow-lg transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-white/90"
                >
                  {canOpenCounterpartChat ? t("go_to_chat") : t("chat_unavailable")}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {deal && deal.paymentExpiresAt && (deal.status === "pending_approval" || (deal.isEscrow && !deal.paidByCustomer && !["cancelled", "rejected", "completed"].includes(deal.status))) ? (
        <ConfirmationDialog
          isOpen={!hasDismissedPaymentNotice}
          onClose={() => setHasDismissedPaymentNotice(true)}
          onConfirm={() => setHasDismissedPaymentNotice(true)}
          title={t("payment_notice_title")}
          showCancelButton={false}
          confirmLabel={t("confirm_understood")}
          description={
            <div className="space-y-3">
              <p>{t("second_party_confirmed")}</p>
              <p className="font-medium text-zinc-950 dark:text-zinc-100">
                {isCustomer
                  ? t("customer_payment_window_notice", {
                      timeRemaining: paymentWindowRemaining,
                    })
                  : t("freelancer_payment_window_notice", {
                      timeRemaining: paymentWindowRemaining,
                    })}
              </p>
            </div>
          }
        />
      ) : null}
    </>
  );
}
