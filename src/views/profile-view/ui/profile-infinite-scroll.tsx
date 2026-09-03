"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import { InfiniteScrollTrigger, Skeleton } from "@/shared/ui";

type Props = {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  hasError: boolean;
  onLoadMore: () => void | Promise<unknown>;
  loadingFallback?: ReactNode;
};

export function ProfileInfiniteScroll({
  hasNextPage,
  isFetchingNextPage,
  hasError,
  onLoadMore,
  loadingFallback,
}: Props) {
  const t = useTranslations("Profile");

  return (
    <InfiniteScrollTrigger
      hasNextPage={hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
      hasError={hasError}
      onLoadMore={onLoadMore}
      loadingLabel={t("LoadingMore")}
      retryLabel={t("RetryLoading")}
      loadMoreLabel={t("LoadMoreOnScroll")}
      className="mt-3"
      loadingFallback={
        loadingFallback ?? (
          <div className="grid gap-3">
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
          </div>
        )
      }
    />
  );
}
