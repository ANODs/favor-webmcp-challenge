"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { portfolioClient } from "@/entities/portfolio-case";
import { authClient, sessionQueryKeys } from "@/entities/session";
import { userQueryKeys, usersClient } from "@/entities/user";
import {
  FavorSubscriptionBanner,
  FavorSubscriptionCheckout,
  type FavorSubscriptionTarget,
} from "@/features/favor-subscription";
import { getUserProfileSlug } from "@/shared/lib/profile";
import {
  buildProfileStartParam,
  buildTelegramMiniAppUrl,
  triggerTelegramNotification,
} from "@/shared/lib/telegram/client";
import { Button, ConfirmationDialog, EmptyState, SurfaceCard } from "@/shared/ui";

import { useProfileSectionQuery } from "../lib/use-profile-section-query";
import { useProfileActiveContractsQuery } from "../lib/use-profile-active-contracts-query";
import {
  ProfileActiveContractsBlock,
  ProfileActiveContractsSkeleton,
} from "./profile-active-contracts-block";
import { ProfileCompletedDealsBlock } from "./profile-completed-deals-block";
import { ProfileInfiniteScroll } from "./profile-infinite-scroll";
import { ProfilePortfolioBlock } from "./profile-portfolio-block";
import { ProfileReferralsBlock } from "./profile-referrals-block";
import { ProfileReviewsBlock } from "./profile-reviews-block";
import {
  getProfileTabId,
  getProfileTabPanelId,
  ProfileSectionTabs,
  type ProfileTabId,
} from "./profile-section-tabs";
import { ProfileSectionContentSkeleton } from "./profile-section-content-skeleton";
import { ProfileSummaryBlock } from "./profile-summary-block";
import { ProfileViewSkeleton } from "./profile-view-skeleton";

type Props = {
  botUsername: string;
  profileSlug?: string;
};

export function ProfileView({ botUsername, profileSlug }: Props) {
  const queryClient = useQueryClient();
  const t = useTranslations("Profile");
  const subscriptionT = useTranslations("FavorSubscription");
  const meQuery = useQuery({
    queryKey: sessionQueryKeys.currentUser,
    queryFn: authClient.getMe,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
  const resolvedProfileSlug = profileSlug ?? (meQuery.data ? getUserProfileSlug(meQuery.data) : null);
  const profileQuery = useQuery({
    queryKey: userQueryKeys.profile(resolvedProfileSlug),
    queryFn: () => usersClient.getProfile(resolvedProfileSlug!),
    enabled: Boolean(resolvedProfileSlug),
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchInterval: 10_000,
    refetchIntervalInBackground: true,
  });
  const [isReferralLinkCopied, setIsReferralLinkCopied] = useState(false);
  const [isCreatingCase, setIsCreatingCase] = useState(false);
  const [caseIdToDelete, setCaseIdToDelete] = useState<number | null>(null);
  const [subscriptionOpen, setSubscriptionOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState<ProfileTabId>("contracts");
  const profile = profileQuery.data;
  const sessionResolved = meQuery.isSuccess;
  const isOwnProfile = Boolean(profile && meQuery.data && profile.user.id === meQuery.data.id);
  const activeTab = selectedTab === "referrals" && !isOwnProfile ? "contracts" : selectedTab;
  const activeContractsQuery = useProfileActiveContractsQuery(
    profile?.user.id ?? null,
    profile?.activeContractsCount ?? 0,
    Boolean(profile && activeTab === "contracts"),
  );
  const portfolioQuery = useProfileSectionQuery(
    resolvedProfileSlug,
    "portfolio",
    Boolean(profile && activeTab === "portfolio"),
  );
  const reviewsQuery = useProfileSectionQuery(
    resolvedProfileSlug,
    "reviews",
    Boolean(profile && activeTab === "reviews"),
  );
  const dealsQuery = useProfileSectionQuery(
    resolvedProfileSlug,
    "deals",
    Boolean(profile && activeTab === "deals"),
  );
  const referralsQuery = useProfileSectionQuery(
    resolvedProfileSlug,
    "referrals",
    Boolean(profile && isOwnProfile && activeTab === "referrals"),
  );
  const contractReferralsQuery = useProfileSectionQuery(
    resolvedProfileSlug,
    "contract-referrals",
    Boolean(profile && isOwnProfile && activeTab === "referrals"),
  );
  const portfolioCases = portfolioQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const caseToDelete = portfolioCases.find(
    (portfolioCase) => portfolioCase.id === caseIdToDelete,
  );
  const reviews = reviewsQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const completedDeals = dealsQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const referrals = referralsQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const contractReferrals =
    contractReferralsQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const activeContracts =
    activeContractsQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const profileBadgeState = isOwnProfile && meQuery.data
    ? {
        isFavorPremium: meQuery.data.isPremium,
        isTelegramPremium: meQuery.data.telegramPremium,
        telegramLevel: meQuery.data.telegramLevel,
        badges: profile?.user.badges ?? [],
      }
    : {
        isFavorPremium: profile?.user.isPremium ?? false,
        isTelegramPremium: profile?.user.telegramPremium ?? false,
        telegramLevel: profile?.user.telegramLevel,
        badges: profile?.user.badges ?? [],
      };
  const displayName =
    profile?.user.name ||
    [profile?.user.telegramFirstName, profile?.user.telegramLastName]
      .filter(Boolean)
      .join(" ") ||
    t("UserDefaultName");
  const subscriptionTarget: FavorSubscriptionTarget | null = profile
    ? {
        id: profile.user.id,
        slug: profile.user.profileSlug,
        displayName,
        isPremium: profileBadgeState.isFavorPremium,
      }
    : null;
  const profileShareUrl = profile && sessionResolved
    ? buildTelegramMiniAppUrl(
        botUsername,
        buildProfileStartParam(profile.user.profileSlug, meQuery.data?.telegramId),
      )
    : null;

  const handleCopyReferralLink = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      triggerTelegramNotification("success");
      setIsReferralLinkCopied(true);
      window.setTimeout(() => setIsReferralLinkCopied(false), 2000);
    } catch {
      triggerTelegramNotification("error");
      setIsReferralLinkCopied(false);
    }
  };

  const deleteCaseMutation = useMutation({
    mutationFn: (id: number) => portfolioClient.deleteCase(id),
    onSuccess: async () => {
      setCaseIdToDelete(null);
      await queryClient.invalidateQueries({ queryKey: userQueryKeys.profiles });
      await queryClient.invalidateQueries({
        queryKey: userQueryKeys.profileSection(
          resolvedProfileSlug,
          "portfolio",
        ),
      });
      await queryClient.invalidateQueries({ queryKey: sessionQueryKeys.currentUser });
    },
  });

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-6">
      {(meQuery.isLoading && !resolvedProfileSlug) || profileQuery.isLoading ? (
        <ProfileViewSkeleton />
      ) : null}

      {!meQuery.data && !meQuery.isLoading && !profileSlug ? (
        <SurfaceCard>
          <EmptyState
            title={t("UserNotFound")}
            description={t("UserNotFoundDesc")}
          />
        </SurfaceCard>
      ) : null}

      {profileQuery.isError && !profile ? (
        <SurfaceCard>
          <EmptyState
            title={t("ProfileNotFound")}
            description={t("ProfileNotFoundDesc")}
          />
        </SurfaceCard>
      ) : null}

      {profile ? (
        <>
          <ProfileSummaryBlock
            profile={profile}
            displayName={displayName}
            isOwnProfile={isOwnProfile}
            profileShareUrl={profileShareUrl}
            profileBadgeState={profileBadgeState}
            onFavorPlusClick={
              sessionResolved ? () => setSubscriptionOpen(true) : undefined
            }
          />

          {meQuery.isError ? (
            <SurfaceCard
              className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
              paddingClassName="p-4 sm:p-5"
              role="alert"
            >
              <p className="text-sm leading-6 text-[var(--muted-foreground)]">
                {subscriptionT("SessionLoadError")}
              </p>
              <Button
                type="button"
                variant="secondary"
                size="md"
                shape="rounded-full"
                className="min-h-11 shrink-0"
                onClick={() => void meQuery.refetch()}
              >
                {subscriptionT("RetrySession")}
              </Button>
            </SurfaceCard>
          ) : subscriptionTarget &&
            !subscriptionTarget.isPremium &&
            sessionResolved ? (
            <FavorSubscriptionBanner
              payerUserId={meQuery.data?.id ?? null}
              target={subscriptionTarget}
              onOpen={() => setSubscriptionOpen(true)}
            />
          ) : null}

          <ProfileSectionTabs
            activeTab={activeTab}
            label={t("ProfileSections")}
            onChange={setSelectedTab}
            items={[
              {
                id: "contracts",
                label: t("TabActiveContracts"),
                count: profile.activeContractsCount,
              },
              {
                id: "portfolio",
                label: t("TabPortfolio"),
                count: profile.portfolioCasesCount,
              },
              {
                id: "reviews",
                label: t("TabReviews"),
                count: profile.receivedReviewsCount,
              },
              {
                id: "deals",
                label: t("TabDeals"),
                count: profile.completedDealsCount,
              },
              ...(isOwnProfile
                ? [
                    {
                      id: "referrals" as const,
                      label: t("TabReferrals"),
                      count: profile.referralsCount + profile.contractReferralsCount,
                    },
                  ]
                : []),
            ]}
          />

          <div
            id={getProfileTabPanelId(activeTab)}
            role="tabpanel"
            aria-labelledby={getProfileTabId(activeTab)}
            tabIndex={0}
            className="rounded-[2rem] outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            {activeTab === "contracts" ? (
              activeContractsQuery.isPending ? (
                <ProfileActiveContractsSkeleton />
              ) : activeContractsQuery.isError && !activeContractsQuery.data ? (
                <ProfileSectionLoadError
                  onRetry={() => void activeContractsQuery.refetch()}
                />
              ) : (
                <>
                  <ProfileActiveContractsBlock
                    contracts={activeContracts}
                    isOwnProfile={isOwnProfile}
                    viewer={meQuery.data ?? null}
                    isViewerLoading={meQuery.isLoading}
                    botUsername={botUsername}
                  />
                  <ProfileInfiniteScroll
                    hasNextPage={Boolean(activeContractsQuery.hasNextPage)}
                    isFetchingNextPage={activeContractsQuery.isFetchingNextPage}
                    hasError={activeContractsQuery.isFetchNextPageError}
                    onLoadMore={activeContractsQuery.fetchNextPage}
                    loadingFallback={<ProfileActiveContractsSkeleton />}
                  />
                </>
              )
            ) : null}

            {activeTab === "portfolio" ? (
              portfolioQuery.isPending ? (
                <ProfileSectionContentSkeleton />
              ) : portfolioQuery.isError && !portfolioQuery.data ? (
                <ProfileSectionLoadError onRetry={() => void portfolioQuery.refetch()} />
              ) : (
                <>
                  <ProfilePortfolioBlock
                    isOwnProfile={isOwnProfile}
                    isCreatingCase={isCreatingCase}
                    portfolioCases={portfolioCases}
                    deletingCaseId={deleteCaseMutation.variables}
                    isDeletingCase={deleteCaseMutation.isPending}
                    onStartCreating={() => setIsCreatingCase(true)}
                    onCancelCreating={() => setIsCreatingCase(false)}
                    onCreated={() => setIsCreatingCase(false)}
                    onDelete={
                      isOwnProfile
                        ? (id) => {
                            deleteCaseMutation.reset();
                            setCaseIdToDelete(id);
                          }
                        : undefined
                    }
                  />
                  <ProfileInfiniteScroll
                    hasNextPage={Boolean(portfolioQuery.hasNextPage)}
                    isFetchingNextPage={portfolioQuery.isFetchingNextPage}
                    hasError={portfolioQuery.isFetchNextPageError}
                    onLoadMore={portfolioQuery.fetchNextPage}
                  />
                </>
              )
            ) : null}

            {activeTab === "reviews" ? (
              reviewsQuery.isPending ? (
                <ProfileSectionContentSkeleton />
              ) : reviewsQuery.isError && !reviewsQuery.data ? (
                <ProfileSectionLoadError onRetry={() => void reviewsQuery.refetch()} />
              ) : (
                <>
                  <ProfileReviewsBlock
                    reviews={reviews}
                    totalCount={profile.receivedReviewsCount}
                    isOwnProfile={isOwnProfile}
                  />
                  <ProfileInfiniteScroll
                    hasNextPage={Boolean(reviewsQuery.hasNextPage)}
                    isFetchingNextPage={reviewsQuery.isFetchingNextPage}
                    hasError={reviewsQuery.isFetchNextPageError}
                    onLoadMore={reviewsQuery.fetchNextPage}
                  />
                </>
              )
            ) : null}

            {activeTab === "deals" ? (
              dealsQuery.isPending ? (
                <ProfileSectionContentSkeleton />
              ) : dealsQuery.isError && !dealsQuery.data ? (
                <ProfileSectionLoadError onRetry={() => void dealsQuery.refetch()} />
              ) : (
                <>
                  <ProfileCompletedDealsBlock
                    deals={completedDeals}
                    totalCount={profile.completedDealsCount}
                  />
                  <ProfileInfiniteScroll
                    hasNextPage={Boolean(dealsQuery.hasNextPage)}
                    isFetchingNextPage={dealsQuery.isFetchingNextPage}
                    hasError={dealsQuery.isFetchNextPageError}
                    onLoadMore={dealsQuery.fetchNextPage}
                  />
                </>
              )
            ) : null}

            {activeTab === "referrals" && isOwnProfile ? (
              referralsQuery.isPending || contractReferralsQuery.isPending ? (
                <ProfileSectionContentSkeleton />
              ) : (referralsQuery.isError && !referralsQuery.data) ||
                (contractReferralsQuery.isError && !contractReferralsQuery.data) ? (
                <ProfileSectionLoadError
                  onRetry={() => {
                    void referralsQuery.refetch();
                    void contractReferralsQuery.refetch();
                  }}
                />
              ) : (
                <ProfileReferralsBlock
                  botUsername={botUsername}
                  telegramId={meQuery.data?.telegramId}
                  referrals={referrals}
                  contractReferrals={contractReferrals}
                  contractReferralStats={profile.contractReferralStats}
                  referralsPagination={{
                    hasNextPage: Boolean(referralsQuery.hasNextPage),
                    isFetchingNextPage: referralsQuery.isFetchingNextPage,
                    hasError: referralsQuery.isFetchNextPageError,
                    onLoadMore: referralsQuery.fetchNextPage,
                  }}
                  contractReferralsPagination={{
                    hasNextPage: Boolean(contractReferralsQuery.hasNextPage),
                    isFetchingNextPage: contractReferralsQuery.isFetchingNextPage,
                    hasError: contractReferralsQuery.isFetchNextPageError,
                    onLoadMore: contractReferralsQuery.fetchNextPage,
                  }}
                  isLinkCopied={isReferralLinkCopied}
                  onCopyLink={handleCopyReferralLink}
                />
              )
            ) : null}
          </div>

          {subscriptionTarget && sessionResolved ? (
            <FavorSubscriptionCheckout
              isOpen={subscriptionOpen}
              onClose={() => setSubscriptionOpen(false)}
              payerUserId={meQuery.data?.id ?? null}
              target={subscriptionTarget}
              botUsername={botUsername}
            />
          ) : null}
        </>
      ) : null}

      <ConfirmationDialog
        isOpen={caseIdToDelete !== null}
        onClose={() => {
          setCaseIdToDelete(null);
          deleteCaseMutation.reset();
        }}
        onConfirm={() => {
          if (caseIdToDelete !== null) {
            deleteCaseMutation.mutate(caseIdToDelete);
          }
        }}
        description={t("DeleteCaseConfirmation", {
          title: caseToDelete?.title ?? t("PortfolioCaseFallback"),
        })}
        confirmLabel={t("DeleteCaseConfirm")}
        pendingLabel={t("DeletingCase")}
        confirmVariant="danger"
        isPending={deleteCaseMutation.isPending}
        errorMessage={
          deleteCaseMutation.isError ? t("DeleteCaseError") : undefined
        }
      />
    </main>
  );
}

function ProfileSectionLoadError({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("Profile");

  return (
    <SurfaceCard className="rounded-[2rem] text-center">
      <p className="text-sm text-red-700">{t("ProfileSectionLoadError")}</p>
      <Button
        type="button"
        variant="secondary"
        size="md"
        shape="rounded-full"
        onClick={onRetry}
        className="mt-4 min-h-11"
      >
        {t("RetryLoading")}
      </Button>
    </SurfaceCard>
  );
}
