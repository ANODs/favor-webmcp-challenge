"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import type { CreateUserBadgePayload, UserBadgeDto } from "@/entities/user";
import { UserBadgePill } from "@/entities/user/ui";
import {
  Button,
  EmptyState,
  InfiniteScrollTrigger,
  SurfaceCard,
} from "@/shared/ui";

import { CreateUserBadgeDialog } from "./create-user-badge-dialog";

type Props = {
  badges: UserBadgeDto[];
  isLoading: boolean;
  isError: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  hasNextPageError: boolean;
  isCreating: boolean;
  createErrorMessage?: string;
  onLoadMore: () => void | Promise<unknown>;
  onRetry: () => void | Promise<unknown>;
  onCreate: (payload: CreateUserBadgePayload) => Promise<void>;
  onStartCreate: () => void;
};

export function BadgeCatalogPanel({
  badges,
  isLoading,
  isError,
  hasNextPage,
  isFetchingNextPage,
  hasNextPageError,
  isCreating,
  createErrorMessage,
  onLoadMore,
  onRetry,
  onCreate,
  onStartCreate,
}: Props) {
  const t = useTranslations("AccountRestrictions");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const openCreateDialog = () => {
    onStartCreate();
    setIsCreateOpen(true);
  };

  return (
    <>
      <SurfaceCard>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-zinc-950 dark:text-white">
              {t("badgeCatalogTitle")}
            </h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {t("badgeCatalogDescription")}
            </p>
          </div>
          <Button
            type="button"
            shape="rounded-full"
            onClick={openCreateDialog}
            aria-label={t("createBadge")}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t("createBadge")}
          </Button>
        </div>
      </SurfaceCard>

      {isLoading ? (
        <SurfaceCard>
          <p role="status" className="text-sm text-zinc-600 dark:text-zinc-400">
            {t("loadingBadges")}
          </p>
        </SurfaceCard>
      ) : null}

      {!isLoading && isError && badges.length === 0 ? (
        <SurfaceCard>
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-red-700 dark:text-red-300">
              {t("loadingBadgesFailed")}
            </p>
            <Button type="button" variant="secondary" onClick={() => void onRetry()}>
              {t("retryLoading")}
            </Button>
          </div>
        </SurfaceCard>
      ) : null}

      {!isLoading && !isError && badges.length === 0 ? (
        <SurfaceCard>
          <EmptyState
            title={t("badgesNotFound")}
            description={t("badgesNotFoundDescription")}
          />
        </SurfaceCard>
      ) : null}

      {badges.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {badges.map((badge) => (
            <SurfaceCard key={badge.id} paddingClassName="p-4">
              <UserBadgePill badge={badge} />
              <div className="mt-4 grid gap-1 text-sm">
                <p className="font-semibold text-zinc-950 dark:text-white">
                  {badge.labelRu}
                </p>
                <p className="text-zinc-600 dark:text-zinc-400">
                  {badge.labelEn}
                </p>
              </div>
            </SurfaceCard>
          ))}
        </div>
      ) : null}

      <InfiniteScrollTrigger
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        hasError={hasNextPageError}
        onLoadMore={onLoadMore}
        onRetry={onRetry}
        loadingLabel={t("loadingMoreBadges")}
        retryLabel={t("retryLoading")}
        loadMoreLabel={t("loadMoreBadgesOnScroll")}
        loadingFallback={
          <SurfaceCard>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {t("loadingMoreBadges")}
            </p>
          </SurfaceCard>
        }
      />

      <CreateUserBadgeDialog
        key={isCreateOpen ? "open" : "closed"}
        isOpen={isCreateOpen}
        isPending={isCreating}
        errorMessage={createErrorMessage}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={onCreate}
      />
    </>
  );
}
