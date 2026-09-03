"use client";

import { Check, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import type {
  CreateUserBadgePayload,
  ModeratedUserDto,
  UserBadgeDto,
} from "@/entities/user";
import { UserBadgePill } from "@/entities/user/ui";
import { Button, Dialog, InfiniteScrollTrigger } from "@/shared/ui";

import { UserBadgeForm } from "./user-badge-form";

type Props = {
  user: ModeratedUserDto | null;
  catalog: UserBadgeDto[];
  isCatalogLoading: boolean;
  isCatalogError: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  hasNextPageError: boolean;
  pendingBadgeId: number | null;
  isCreating: boolean;
  errorMessage?: string;
  onClose: () => void;
  onRetryCatalog: () => void | Promise<unknown>;
  onLoadMore: () => void | Promise<unknown>;
  onAssign: (userId: number, badge: UserBadgeDto) => Promise<void>;
  onRemove: (userId: number, badge: UserBadgeDto) => Promise<void>;
  onCreateAndAssign: (
    userId: number,
    payload: CreateUserBadgePayload,
  ) => Promise<void>;
  onStartAction: () => void;
};

export function UserBadgeManagerDialog({
  user,
  catalog,
  isCatalogLoading,
  isCatalogError,
  hasNextPage,
  isFetchingNextPage,
  hasNextPageError,
  pendingBadgeId,
  isCreating,
  errorMessage,
  onClose,
  onRetryCatalog,
  onLoadMore,
  onAssign,
  onRemove,
  onCreateAndAssign,
  onStartAction,
}: Props) {
  const t = useTranslations("AccountRestrictions");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const displayedBadges = useMemo(() => {
    const byId = new Map<number, UserBadgeDto>();
    user?.badges.forEach((badge) => byId.set(badge.id, badge));
    catalog.forEach((badge) => byId.set(badge.id, badge));
    return [...byId.values()].sort(
      (left, right) => left.sortOrder - right.sortOrder || left.id - right.id,
    );
  }, [catalog, user]);
  const assignedIds = useMemo(
    () => new Set(user?.badges.map((badge) => badge.id) ?? []),
    [user],
  );
  const userLabel =
    user?.name ||
    (user?.isTelegramUsernameHidden ? null : user?.telegramUsername) ||
    (user ? t("userFallback", { id: user.id }) : "");
  const hasPendingAction = pendingBadgeId !== null || isCreating;

  return (
    <Dialog
      isOpen={Boolean(user)}
      onClose={onClose}
      ariaLabel={t("manageBadgesDialogAriaLabel")}
      contentClassName="rounded-[2rem] bg-white p-5 shadow-2xl dark:bg-zinc-950 sm:p-6"
      closeOnOverlayClick={!hasPendingAction}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-zinc-950 dark:text-white">
            {t("manageBadgesTitle")}
          </h3>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {userLabel}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={hasPendingAction}
          aria-label={t("closeBadgeDialog")}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 dark:hover:bg-white/10"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-6 grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-sm font-semibold text-zinc-900 dark:text-white">
            {t("badgeCatalogTitle")}
          </h4>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            shape="rounded-full"
            disabled={hasPendingAction}
            onClick={() => {
              onStartAction();
              setIsCreateOpen((current) => !current);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t("createBadge")}
          </Button>
        </div>

        {isCatalogLoading && displayedBadges.length === 0 ? (
          <p role="status" className="text-sm text-zinc-600 dark:text-zinc-400">
            {t("loadingBadges")}
          </p>
        ) : null}

        {isCatalogError && displayedBadges.length === 0 ? (
          <div className="flex flex-col items-start gap-2">
            <p className="text-sm text-red-700 dark:text-red-300">
              {t("loadingBadgesFailed")}
            </p>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => void onRetryCatalog()}
            >
              {t("retryLoading")}
            </Button>
          </div>
        ) : null}

        {displayedBadges.length > 0 ? (
          <div className="grid max-h-64 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
            {displayedBadges.map((badge) => {
              const isAssigned = assignedIds.has(badge.id);
              const isPending = pendingBadgeId === badge.id;

              return (
                <button
                  key={badge.id}
                  type="button"
                  aria-pressed={isAssigned}
                  disabled={hasPendingAction}
                  onClick={() => {
                    if (!user) {
                      return;
                    }

                    onStartAction();
                    const action = isAssigned
                      ? onRemove(user.id, badge)
                      : onAssign(user.id, badge);
                    void action.catch(() => undefined);
                  }}
                  className={`flex min-w-0 items-center justify-between gap-2 rounded-2xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-wait disabled:opacity-60 ${
                    isAssigned
                      ? "border-emerald-300 bg-emerald-50/70 dark:border-emerald-700 dark:bg-emerald-950/20"
                      : "border-zinc-200 hover:bg-zinc-50 dark:border-white/15 dark:hover:bg-white/5"
                  }`}
                >
                  <UserBadgePill badge={badge} tooltipFocusable={false} />
                  <span className="shrink-0 text-zinc-500">
                    {isPending ? (
                      <span className="text-xs">{t("savingBadge")}</span>
                    ) : isAssigned ? (
                      <Check className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Plus className="h-4 w-4" aria-hidden="true" />
                    )}
                  </span>
                </button>
              );
            })}

            <InfiniteScrollTrigger
              hasNextPage={hasNextPage}
              isFetchingNextPage={isFetchingNextPage}
              hasError={hasNextPageError}
              onLoadMore={onLoadMore}
              onRetry={onRetryCatalog}
              loadingLabel={t("loadingMoreBadges")}
              retryLabel={t("retryLoading")}
              loadMoreLabel={t("loadMoreBadgesOnScroll")}
              loadingFallback={
                <p className="py-2 text-sm text-zinc-600 dark:text-zinc-400">
                  {t("loadingMoreBadges")}
                </p>
              }
              className="mt-0 sm:col-span-2"
            />
          </div>
        ) : null}
      </div>

      {isCreateOpen && user ? (
        <div className="mt-6 border-t border-zinc-100 pt-5 dark:border-white/10">
          <h4 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-white">
            {t("createAndAssignBadge")}
          </h4>
          <UserBadgeForm
            submitLabel={t("createAndAssignBadge")}
            isPending={isCreating}
            errorMessage={errorMessage}
            onSubmit={(payload) => onCreateAndAssign(user.id, payload)}
            onCancel={() => setIsCreateOpen(false)}
            onCompleted={() => setIsCreateOpen(false)}
          />
        </div>
      ) : errorMessage ? (
        <p role="alert" className="mt-4 text-sm text-red-700 dark:text-red-300">
          {errorMessage}
        </p>
      ) : null}
    </Dialog>
  );
}
