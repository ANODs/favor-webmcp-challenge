"use client";

import { useTranslations } from "next-intl";

import { InfiniteScrollTrigger } from "@/shared/ui";
import { ContractCardSkeleton } from "@/widgets/contract-feed";

type Props = {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  hasError: boolean;
  onLoadMore: () => void | Promise<unknown>;
};

export function ContractFeedInfiniteScroll({
  hasNextPage,
  isFetchingNextPage,
  hasError,
  onLoadMore,
}: Props) {
  const t = useTranslations("Contracts");

  return (
    <InfiniteScrollTrigger
      hasNextPage={hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
      hasError={hasError}
      onLoadMore={onLoadMore}
      loadingLabel={t("LoadingMore")}
      retryLabel={t("RetryLoading")}
      loadMoreLabel={t("LoadMoreOnScroll")}
      loadingFallback={
        <div className="grid gap-4">
          <ContractCardSkeleton />
          <ContractCardSkeleton />
        </div>
      }
    />
  );
}
