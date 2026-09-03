"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { contractQueryKeys, contractsClient } from "@/entities/contract";
import { authClient, sessionQueryKeys } from "@/entities/session";
import {
  userQueryKeys,
  type CreateAccountRestrictionPayload,
  type CreateUserBadgePayload,
  type ModeratedUserDto,
  type UserBadgeDto,
} from "@/entities/user";
import {
  accountModerationClient,
  accountModerationQueryKeys,
  BadgeCatalogPanel,
  UserBadgeManagerDialog,
} from "@/features/account-moderation";
import {
  CONTRACT_MODERATION_QUEUE_FILTER,
  moderationClient,
} from "@/features/contract-ai-moderation/client";
import { Link } from "@/i18n/routing";
import { env } from "@/shared/config/env";
import { routes } from "@/shared/config/routes";
import {
  Button,
  EmptyState,
  InfiniteScrollTrigger,
  SurfaceCard,
} from "@/shared/ui";
import { AccountModerationPanel } from "@/widgets/account-moderation-panel";
import { ContractCardSkeleton } from "@/widgets/contract-feed";
import {
  SearchFilterWidget,
  toContractListFilters,
  useLocalSearchFilters,
} from "@/widgets/search-filter";

import { ModerationPanel } from "./moderation-panel";

type ModerationSection = "contracts" | "accounts" | "badges";

export function ModerationView() {
  const t = useTranslations("ModerationView");
  const tAccounts = useTranslations("AccountRestrictions");
  const tContracts = useTranslations("Contracts");
  const queryClient = useQueryClient();
  const [errorMessage, setErrorMessage] = useState("");
  const [section, setSection] = useState<ModerationSection>("contracts");
  const [accountSearch, setAccountSearch] = useState("");
  const [badgeUser, setBadgeUser] = useState<ModeratedUserDto | null>(null);
  const [badgeErrorMessage, setBadgeErrorMessage] = useState("");
  const {
    filters,
    setFilters,
    isFiltersOpen,
    setIsFiltersOpen,
  } = useLocalSearchFilters({
    status: CONTRACT_MODERATION_QUEUE_FILTER,
    sortBy: "",
    sortOrder: "asc",
  });

  const meQuery = useQuery({
    queryKey: sessionQueryKeys.currentUser,
    queryFn: authClient.getMe,
  });
  const isModerator = meQuery.data?.role === "moderator";
  const contractFilters = useMemo(
    () => toContractListFilters(filters, { isModerator }),
    [filters, isModerator],
  );
  const contractModerationQueryKey = contractQueryKeys.moderationList(
    contractFilters,
  );

  const moderationQuery = useInfiniteQuery({
    queryKey: contractModerationQueryKey,
    queryFn: ({ pageParam }) =>
      contractsClient.getModerationList(contractFilters, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: isModerator && section === "contracts",
  });
  const contracts = useMemo(
    () => moderationQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [moderationQuery.data],
  );
  const refreshContractsAfterModeration = async () => {
    await queryClient.invalidateQueries({
      queryKey: contractQueryKeys.all,
      refetchType: "none",
    });
    await queryClient.resetQueries({
      queryKey: contractQueryKeys.moderationLists,
    });
  };

  const accountsQuery = useInfiniteQuery({
    queryKey: accountModerationQueryKeys.list(accountSearch),
    queryFn: ({ pageParam }) =>
      accountModerationClient.getUsers(accountSearch, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: isModerator && section === "accounts",
  });
  const users = useMemo(
    () => accountsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [accountsQuery.data],
  );
  const badgeCatalogQuery = useInfiniteQuery({
    queryKey: accountModerationQueryKeys.badgeCatalog,
    queryFn: ({ pageParam }) => accountModerationClient.getBadges(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: isModerator && (section === "badges" || badgeUser !== null),
  });
  const badgeCatalog = useMemo(
    () => badgeCatalogQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [badgeCatalogQuery.data],
  );

  const refreshUsersAfterBadgeChange = async () => {
    await Promise.all([
      queryClient.resetQueries({
        queryKey: accountModerationQueryKeys.lists(),
      }),
      queryClient.invalidateQueries({ queryKey: userQueryKeys.profiles }),
    ]);
  };

  const addBadgeToSelectedUser = (userId: number, badge: UserBadgeDto) => {
    setBadgeUser((current) => {
      if (!current || current.id !== userId) {
        return current;
      }

      const badges = [
        ...current.badges.filter((currentBadge) => currentBadge.id !== badge.id),
        badge,
      ].sort(
        (left, right) =>
          left.sortOrder - right.sortOrder || left.id - right.id,
      );

      return { ...current, badges };
    });
  };

  const removeBadgeFromSelectedUser = (userId: number, badgeId: number) => {
    setBadgeUser((current) =>
      current?.id === userId
        ? {
            ...current,
            badges: current.badges.filter((badge) => badge.id !== badgeId),
          }
        : current,
    );
  };

  const approveMutation = useMutation({
    mutationFn: moderationClient.approveContract,
    onSuccess: async () => {
      setErrorMessage("");
      await refreshContractsAfterModeration();
    },
    onError: async () => {
      setErrorMessage(t("approveError"));
      await refreshContractsAfterModeration();
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, comment }: { id: number; comment: string }) =>
      moderationClient.rejectContract(id, comment),
    onSuccess: async () => {
      setErrorMessage("");
      await refreshContractsAfterModeration();
    },
    onError: async () => {
      setErrorMessage(t("rejectError"));
      await refreshContractsAfterModeration();
    },
  });

  const archiveMutation = useMutation({
    mutationFn: ({ id, comment }: { id: number; comment: string }) =>
      moderationClient.archiveContract(id, comment),
    onSuccess: async () => {
      setErrorMessage("");
      await refreshContractsAfterModeration();
    },
    onError: async () => {
      setErrorMessage(t("archiveError"));
      await refreshContractsAfterModeration();
    },
  });

  const createRestrictionMutation = useMutation({
    mutationFn: ({
      userId,
      payload,
    }: {
      userId: number;
      payload: CreateAccountRestrictionPayload;
    }) => accountModerationClient.createRestriction(userId, payload),
    onSuccess: async () => {
      setErrorMessage("");
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: accountModerationQueryKeys.lists(),
        }),
        queryClient.invalidateQueries({ queryKey: contractQueryKeys.all }),
      ]);
    },
    onError: () => {
      setErrorMessage(t("restrictError"));
    },
  });

  const revokeRestrictionMutation = useMutation({
    mutationFn: ({
      userId,
      restrictionId,
      comment,
    }: {
      userId: number;
      restrictionId: number;
      comment: string;
    }) =>
      accountModerationClient.revokeRestriction(
        userId,
        restrictionId,
        comment,
      ),
    onSuccess: async () => {
      setErrorMessage("");
      await queryClient.invalidateQueries({
        queryKey: accountModerationQueryKeys.lists(),
      });
    },
    onError: () => {
      setErrorMessage(t("revokeError"));
    },
  });

  const createBadgeMutation = useMutation({
    mutationFn: async ({
      payload,
      userId,
    }: {
      payload: CreateUserBadgePayload;
      userId: number | null;
    }) => {
      const badge =
        userId === null
          ? await accountModerationClient.createBadge(payload)
          : await accountModerationClient.createAndAssignBadge(
              userId,
              payload,
            );

      return { badge, userId };
    },
    onSuccess: async ({ badge, userId }) => {
      setBadgeErrorMessage("");

      if (userId !== null) {
        addBadgeToSelectedUser(userId, badge);
        await refreshUsersAfterBadgeChange();
      }
    },
    onError: () => {
      setBadgeErrorMessage(tAccounts("createBadgeError"));
    },
    onSettled: async () => {
      await queryClient.resetQueries({
        queryKey: accountModerationQueryKeys.badgeCatalog,
        exact: true,
      });
    },
  });

  const assignBadgeMutation = useMutation({
    mutationFn: ({ userId, badge }: { userId: number; badge: UserBadgeDto }) =>
      accountModerationClient.assignBadge(userId, badge.id),
    onSuccess: async (badge, { userId }) => {
      setBadgeErrorMessage("");
      addBadgeToSelectedUser(userId, badge);
      await refreshUsersAfterBadgeChange();
    },
    onError: async () => {
      setBadgeErrorMessage(tAccounts("assignBadgeError"));
      await refreshUsersAfterBadgeChange();
    },
  });

  const removeBadgeMutation = useMutation({
    mutationFn: ({ userId, badge }: { userId: number; badge: UserBadgeDto }) =>
      accountModerationClient.removeBadge(userId, badge.id),
    onSuccess: async (_result, { userId, badge }) => {
      setBadgeErrorMessage("");
      removeBadgeFromSelectedUser(userId, badge.id);
      await refreshUsersAfterBadgeChange();
    },
    onError: async () => {
      setBadgeErrorMessage(tAccounts("removeBadgeError"));
      await refreshUsersAfterBadgeChange();
    },
  });

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-6">
      {!isModerator && !meQuery.isLoading ? (
        <SurfaceCard>
          <EmptyState
            title={t("accessDeniedTitle")}
            description={t("accessDeniedDescription")}
          />
        </SurfaceCard>
      ) : null}

      {isModerator ? (
        <SurfaceCard>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-zinc-950 dark:text-white">
                {t("title")}
              </h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {t("description")}
              </p>
            </div>
            <Link
              href={routes.feed}
              className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-white/15 dark:text-zinc-200 dark:hover:bg-white/5"
            >
              {t("backToFeed")}
            </Link>
          </div>
          <div className="mt-5 flex flex-wrap gap-2 border-t border-zinc-100 pt-4 dark:border-white/10">
            {([
              ["contracts", t("contractsTab")],
              ["accounts", t("accountsTab")],
              ["badges", t("badgesTab")],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setErrorMessage("");
                  setBadgeErrorMessage("");
                  setBadgeUser(null);
                  setSection(value);
                }}
                className={`rounded-full px-3 py-2 text-sm font-semibold transition sm:px-4 ${
                  section === value
                    ? "bg-zinc-950 text-white dark:bg-white dark:text-zinc-950"
                    : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-white/10"
                }`}
                aria-pressed={section === value}
              >
                {label}
              </button>
            ))}
          </div>
        </SurfaceCard>
      ) : null}

      {errorMessage ? (
        <SurfaceCard>
          <p className="text-sm text-red-700 dark:text-red-300">
            {errorMessage}
          </p>
        </SurfaceCard>
      ) : null}

      {section === "contracts" && isModerator ? (
        <>
          <SearchFilterWidget
            filters={filters}
            setFilters={setFilters}
            isFiltersOpen={isFiltersOpen}
            setIsFiltersOpen={setIsFiltersOpen}
            isModerator
            additionalStatusOptions={[
              {
                value: CONTRACT_MODERATION_QUEUE_FILTER,
                label: t("queueFilter"),
              },
            ]}
          />

          {moderationQuery.isLoading ? (
            <div className="grid gap-4" role="status" aria-label={t("loadingQueue")}>
              <ContractCardSkeleton />
              <ContractCardSkeleton />
              <ContractCardSkeleton />
            </div>
          ) : null}

          {moderationQuery.isError && contracts.length === 0 ? (
            <SurfaceCard>
              <div className="flex flex-col items-start gap-3">
                <p className="text-sm text-red-700 dark:text-red-300">
                  {t("loadingContractsFailed")}
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void moderationQuery.refetch()}
                >
                  {tContracts("RetryLoading")}
                </Button>
              </div>
            </SurfaceCard>
          ) : null}

          {!moderationQuery.isLoading &&
          !moderationQuery.isError &&
          !moderationQuery.hasNextPage &&
          contracts.length === 0 ? (
            <SurfaceCard>
              <EmptyState
                title={t("emptyQueueTitle")}
                description={t("emptyQueueDescription")}
              />
            </SurfaceCard>
          ) : null}

          {contracts.length > 0 ? (
            <ModerationPanel
              contracts={contracts}
              botUsername={env.telegramBotUsername}
              viewerTelegramId={meQuery.data?.telegramId}
              approvePendingId={
                approveMutation.isPending
                  ? approveMutation.variables ?? null
                  : null
              }
              rejectPendingId={
                rejectMutation.isPending
                  ? rejectMutation.variables?.id ?? null
                  : null
              }
              archivePendingId={
                archiveMutation.isPending
                  ? archiveMutation.variables?.id ?? null
                  : null
              }
              onApprove={async (id) => {
                await approveMutation.mutateAsync(id);
              }}
              onReject={async (id, comment) => {
                if (comment.trim().length < 3) {
                  setErrorMessage(t("rejectCommentRequired"));
                  return;
                }

                await rejectMutation.mutateAsync({ id, comment });
              }}
              onArchive={async (id, comment) => {
                if (comment.trim().length < 3) {
                  setErrorMessage(t("archiveCommentRequired"));
                  return;
                }

                await archiveMutation.mutateAsync({ id, comment });
              }}
            />
          ) : null}

          <InfiniteScrollTrigger
            hasNextPage={Boolean(moderationQuery.hasNextPage)}
            isFetchingNextPage={moderationQuery.isFetchingNextPage}
            hasError={moderationQuery.isFetchNextPageError}
            onLoadMore={moderationQuery.fetchNextPage}
            onRetry={() =>
              queryClient.resetQueries({
                queryKey: contractModerationQueryKey,
                exact: true,
              })
            }
            loadingLabel={tContracts("LoadingMore")}
            retryLabel={tContracts("RetryLoading")}
            loadMoreLabel={tContracts("LoadMoreOnScroll")}
            loadingFallback={
              <div className="grid gap-4">
                <ContractCardSkeleton />
                <ContractCardSkeleton />
              </div>
            }
          />
        </>
      ) : null}

      {section === "accounts" && isModerator && meQuery.data ? (
        <>
          <AccountModerationPanel
            currentModeratorId={meQuery.data.id}
            users={users}
            searchValue={accountSearch}
            isLoading={accountsQuery.isLoading}
            isError={accountsQuery.isError && users.length === 0}
            actionUserId={
              createRestrictionMutation.isPending
                ? createRestrictionMutation.variables?.userId ?? null
                : revokeRestrictionMutation.isPending
                  ? revokeRestrictionMutation.variables?.userId ?? null
                  : null
            }
            onSearch={(value) => {
              setBadgeUser(null);
              setAccountSearch(value.trim());
            }}
            onRetry={accountsQuery.refetch}
            onManageBadges={(user) => {
              setBadgeErrorMessage("");
              setBadgeUser(user);
            }}
            onCreateRestriction={async (userId, payload) => {
              await createRestrictionMutation.mutateAsync({ userId, payload });
            }}
            onRevokeRestriction={async (userId, restrictionId, comment) => {
              await revokeRestrictionMutation.mutateAsync({
                userId,
                restrictionId,
                comment,
              });
            }}
          />

          <InfiniteScrollTrigger
            hasNextPage={Boolean(accountsQuery.hasNextPage)}
            isFetchingNextPage={accountsQuery.isFetchingNextPage}
            hasError={accountsQuery.isFetchNextPageError}
            onLoadMore={accountsQuery.fetchNextPage}
            loadingLabel={tAccounts("loadingMoreAccounts")}
            retryLabel={tAccounts("retryLoading")}
            loadMoreLabel={tAccounts("loadMoreAccountsOnScroll")}
            loadingFallback={
              <SurfaceCard>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {tAccounts("loadingMoreAccounts")}
                </p>
              </SurfaceCard>
            }
          />
        </>
      ) : null}

      {section === "badges" && isModerator ? (
        <BadgeCatalogPanel
          badges={badgeCatalog}
          isLoading={badgeCatalogQuery.isLoading}
          isError={badgeCatalogQuery.isError}
          hasNextPage={Boolean(badgeCatalogQuery.hasNextPage)}
          isFetchingNextPage={badgeCatalogQuery.isFetchingNextPage}
          hasNextPageError={badgeCatalogQuery.isFetchNextPageError}
          isCreating={createBadgeMutation.isPending}
          createErrorMessage={badgeErrorMessage || undefined}
          onLoadMore={badgeCatalogQuery.fetchNextPage}
          onRetry={() =>
            queryClient.resetQueries({
              queryKey: accountModerationQueryKeys.badgeCatalog,
              exact: true,
            })
          }
          onStartCreate={() => setBadgeErrorMessage("")}
          onCreate={(payload) =>
            createBadgeMutation
              .mutateAsync({ payload, userId: null })
              .then(() => undefined)
          }
        />
      ) : null}

      <UserBadgeManagerDialog
        key={badgeUser?.id ?? "closed"}
        user={badgeUser}
        catalog={badgeCatalog}
        isCatalogLoading={badgeCatalogQuery.isLoading}
        isCatalogError={badgeCatalogQuery.isError}
        hasNextPage={Boolean(badgeCatalogQuery.hasNextPage)}
        isFetchingNextPage={badgeCatalogQuery.isFetchingNextPage}
        hasNextPageError={badgeCatalogQuery.isFetchNextPageError}
        pendingBadgeId={
          assignBadgeMutation.isPending
            ? assignBadgeMutation.variables?.badge.id ?? null
            : removeBadgeMutation.isPending
              ? removeBadgeMutation.variables?.badge.id ?? null
              : null
        }
        isCreating={createBadgeMutation.isPending}
        errorMessage={badgeErrorMessage || undefined}
        onClose={() => {
          setBadgeErrorMessage("");
          setBadgeUser(null);
        }}
        onRetryCatalog={() =>
          queryClient.resetQueries({
            queryKey: accountModerationQueryKeys.badgeCatalog,
            exact: true,
          })
        }
        onLoadMore={badgeCatalogQuery.fetchNextPage}
        onAssign={(userId, badge) =>
          assignBadgeMutation
            .mutateAsync({ userId, badge })
            .then(() => undefined)
        }
        onRemove={(userId, badge) =>
          removeBadgeMutation
            .mutateAsync({ userId, badge })
            .then(() => undefined)
        }
        onCreateAndAssign={(userId, payload) =>
          createBadgeMutation
            .mutateAsync({ payload, userId })
            .then(() => undefined)
        }
        onStartAction={() => setBadgeErrorMessage("")}
      />
    </main>
  );
}
