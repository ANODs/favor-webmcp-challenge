"use client";

import { useRouter } from "@/i18n/routing";
import { routes } from "@/shared/config/routes";
import { TELEGRAM_MINI_APP_START_PARAMS } from "@/shared/lib/telegram";
import { useGuestLock } from "@/shared/lib/use-guest-lock";
import { ActionCardButton, GuestLockDialog } from "@/shared/ui";
import { SurfaceCard } from "@/shared/ui/surface-card";
import { useTranslations } from "next-intl";
import { ContractCard, ContractCardSkeleton } from "@/widgets/contract-feed";
import { CategoryAuctionPanel } from "@/features/category-auction";

import { SearchFilterWidget } from "@/widgets/search-filter";

import { useContractFeed } from "../lib/use-contract-feed";
import { ContractFeedInfiniteScroll } from "./contract-feed-infinite-scroll";

type Props = {
  botUsername: string;
};

export function ContractFeedView({ botUsername }: Props) {
  const router = useRouter();
  const {
    filters,
    setFilters,
    isFiltersOpen,
    setIsFiltersOpen,
    resetFilters,
    hasActiveFilters,
    searchHistory,
    rememberSearch,
    removeSearch,
    clearSearchHistory,
    isSearchFiltersHydrated,
    meQuery,
    isModerator,
    contractsQuery,
    contracts,
  } = useContractFeed();
  const t = useTranslations("Contracts");
  const {
    isLocked,
    lockedItemLabel,
    telegramContinueUrl,
    handleRequireAuth,
    closeLock,
  } = useGuestLock(botUsername);
  const createContractLabel = t("CreateContractBtn");
  const isFeedLoading =
    !isSearchFiltersHydrated || meQuery.isLoading || contractsQuery.isLoading;

  const handleFavoritesOnlyChange = (checked: boolean) => {
    if (checked && !meQuery.data) {
      handleRequireAuth({
        label: t("Favorites"),
        startApp: TELEGRAM_MINI_APP_START_PARAMS.feed,
      });
      return;
    }

    setFilters((current) => ({ ...current, favoritesOnly: checked }));
  };

  const handleCreateContract = () => {
    router.push(routes.createContract);
  };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-6">
      <SearchFilterWidget
        filters={filters}
        setFilters={setFilters}
        isFiltersOpen={isFiltersOpen}
        setIsFiltersOpen={setIsFiltersOpen}
        isModerator={isSearchFiltersHydrated && isModerator}
        favoritesEnabled={isSearchFiltersHydrated && !meQuery.isLoading}
        onFavoritesOnlyChange={handleFavoritesOnlyChange}
        hasActiveFilters={hasActiveFilters}
        onResetFilters={resetFilters}
        searchHistory={searchHistory}
        onSearchCommit={rememberSearch}
        onSearchHistoryRemove={removeSearch}
        onSearchHistoryClear={clearSearchHistory}
        isReady={isSearchFiltersHydrated}
      />

      {filters.category ? <CategoryAuctionPanel categoryName={filters.category} /> : null}

      {isFeedLoading ? (
        <div className="grid gap-4">
          <ContractCardSkeleton />
          <ContractCardSkeleton />
          <ContractCardSkeleton />
        </div>
      ) : null}

      {contractsQuery.isError ? (
        <SurfaceCard>
          <p className="text-sm text-red-700">
            {t("LoadingContractsFailed")}
          </p>
        </SurfaceCard>
      ) : null}


      <div className="grid gap-4">
        {contracts.map((contract) => (
          <ContractCard
            key={contract.id}
            contract={contract}
            viewerId={meQuery.data?.id ?? null}
            viewerRole={meQuery.data?.role}
            viewerTelegramId={meQuery.data?.telegramId}
            botUsername={meQuery.isLoading ? undefined : botUsername}
            showFavoriteAction
            isViewerLoading={meQuery.isLoading}
            onFavoriteAuthRequired={() =>
              handleRequireAuth({
                label: t("Favorites"),
                startApp: TELEGRAM_MINI_APP_START_PARAMS.feed,
              })
            }
          />
        ))}
      </div>

      <ContractFeedInfiniteScroll
        hasNextPage={Boolean(contractsQuery.hasNextPage)}
        isFetchingNextPage={contractsQuery.isFetchingNextPage}
        hasError={contractsQuery.isFetchNextPageError}
        onLoadMore={contractsQuery.fetchNextPage}
      />

      {!isFeedLoading && !contractsQuery.isError ? (
        <div className="mt-2 flex flex-col items-center gap-4 pb-2 text-center">
          <div className="max-w-2xl">
            <p className="text-lg font-semibold text-zinc-950">
              {t("NotFoundTitle")}
            </p>
            <p className="mt-2 text-sm text-zinc-600">
              {t("NotFoundDesc")}
            </p>
          </div>
          <ActionCardButton
            type="button"
            tone="primary"
            className="h-12 max-w-3xl"
            onClick={handleCreateContract}
          >
            {createContractLabel}
          </ActionCardButton>
        </div>
      ) : null}

      <GuestLockDialog
        isOpen={isLocked}
        lockedItemLabel={lockedItemLabel}
        telegramContinueUrl={telegramContinueUrl}
        onClose={closeLock}
      />
    </main>
  );
}
