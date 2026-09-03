"use client";

import { useEffect, useRef, type ReactNode } from "react";

type Props = {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  hasError: boolean;
  onLoadMore: () => void | Promise<unknown>;
  onRetry?: () => void | Promise<unknown>;
  loadingLabel: string;
  retryLabel: string;
  loadMoreLabel: string;
  loadingFallback: ReactNode;
  className?: string;
};

export function InfiniteScrollTrigger({
  hasNextPage,
  isFetchingNextPage,
  hasError,
  onLoadMore,
  onRetry,
  loadingLabel,
  retryLabel,
  loadMoreLabel,
  loadingFallback,
  className = "mt-2",
}: Props) {
  const triggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trigger = triggerRef.current;

    if (!trigger || !hasNextPage || isFetchingNextPage || hasError) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          void onLoadMore();
        }
      },
      { rootMargin: "320px 0px" },
    );

    observer.observe(trigger);

    return () => observer.disconnect();
  }, [hasError, hasNextPage, isFetchingNextPage, onLoadMore]);

  if (!hasNextPage && !hasError) {
    return null;
  }

  return (
    <div ref={triggerRef} className={className} aria-live="polite">
      {hasError ? (
        <button
          type="button"
          onClick={() => void (onRetry ?? onLoadMore)()}
          className="flex w-full items-center justify-center rounded-2xl border border-zinc-200 px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:border-white/15 dark:text-zinc-200 dark:hover:border-white/25 dark:hover:bg-white/5"
        >
          {retryLabel}
        </button>
      ) : isFetchingNextPage ? (
        <div role="status" aria-label={loadingLabel}>
          {loadingFallback}
        </div>
      ) : (
        <span className="sr-only">{loadMoreLabel}</span>
      )}
    </div>
  );
}
