"use client";

import { useQuery } from "@tanstack/react-query";
import { ExternalLink, FileText, MessageCircleQuestion, Star } from "lucide-react";
import { Unbounded } from "next/font/google";
import { useLocale, useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import {
  buildContractShareText,
  contractStatusMeta,
  isUnclaimedScoutContract,
  type ContractDto,
} from "@/entities/contract";
import {
  ContractTerms,
  DynamicContractImage,
} from "@/entities/contract/ui";
import { getCategoryLabel } from "@/entities/category";
import {
  contractQuestionQueryKeys,
  contractQuestionsClient,
} from "@/entities/contract-question";
import { ReviewCard } from "@/entities/review";
import { ContractQuestionsPanel } from "@/features/contract-questions";
import { TelegramStoryShareButton } from "@/features/share-telegram-story";
import { ToggleContractFavoriteButton } from "@/features/toggle-contract-favorite";
import { Link } from "@/i18n/routing";
import { routes } from "@/shared/config/routes";
import { formatCurrency, formatDateTime } from "@/shared/lib/format";
import { getUserProfileSlug } from "@/shared/lib/profile";
import { buildContractStartParam, buildTelegramMiniAppUrl } from "@/shared/lib/telegram";
import {
  CalendarIcon,
  Button,
  CompletedIcon,
  ContextualHint,
  DealTypeBadge,
  EyeIcon,
  PeopleIcon,
  RatingStars,
  StatusPill,
  SurfaceCard,
  UserIcon,
} from "@/shared/ui";

type ContractTabId = "details" | "questions" | "reviews";
type DesktopContractTabId = Exclude<ContractTabId, "details">;
const CONTRACT_SHARE_HINT_STORAGE_PREFIX = "favor.contract-share-hint.v1";
const CONTRACT_DETAILS_DESKTOP_QUERY = "(min-width: 1280px)";
const unbounded = Unbounded({ subsets: ["latin", "cyrillic"] });

type Props = {
  contract: ContractDto;
  showStatus?: boolean;
  viewerId?: number | null;
  viewerTelegramId?: string | bigint | number | null;
  botUsername?: string;
  showFavoriteAction?: boolean;
  isViewerLoading?: boolean;
  primaryAction?: ReactNode;
  sidebarFooter?: ReactNode;
  onFavoriteAuthRequired?: () => void;
  onQuestionAuthRequired?: () => void;
  focusSection?: "questions" | null;
  onSectionFocused?: () => void;
};

export function ContractDetails({
  contract,
  showStatus = false,
  viewerId,
  viewerTelegramId,
  botUsername,
  showFavoriteAction = false,
  isViewerLoading = false,
  primaryAction,
  sidebarFooter,
  onFavoriteAuthRequired,
  onQuestionAuthRequired,
  focusSection,
  onSectionFocused,
}: Props) {
  const t = useTranslations("Contracts");
  const tDetails = useTranslations("ContractDetails");
  const tSearch = useTranslations("SearchFilter");
  const locale = useLocale() as "ru" | "en";
  const localeCode = locale === "en" ? "en-US" : "ru-RU";
  const [isDesktopLayout, setIsDesktopLayout] = useState(false);
  const [mobileActiveTab, setMobileActiveTab] =
    useState<ContractTabId>("details");
  const [desktopActiveTab, setDesktopActiveTab] =
    useState<DesktopContractTabId>(
      contract.questionsEnabled ? "questions" : "reviews",
    );
  const [isShareHintOpen, setIsShareHintOpen] = useState(false);
  const statusMeta = contractStatusMeta[contract.status];
  const shareUrl = botUsername
    ? buildTelegramMiniAppUrl(
        botUsername,
        buildContractStartParam(contract.slug, viewerTelegramId),
      )
    : null;
  const shareHintStorageKey = `${CONTRACT_SHARE_HINT_STORAGE_PREFIX}.${contract.id}`;
  const canShowShareHint =
    !isViewerLoading &&
    viewerId === contract.authorId &&
    !isUnclaimedScoutContract(contract) &&
    Boolean(shareUrl);

  useEffect(() => {
    const mediaQuery = window.matchMedia(CONTRACT_DETAILS_DESKTOP_QUERY);
    const updateLayout = () => setIsDesktopLayout(mediaQuery.matches);

    updateLayout();
    mediaQuery.addEventListener("change", updateLayout);

    return () => mediaQuery.removeEventListener("change", updateLayout);
  }, []);

  useEffect(() => {
    if (focusSection !== "questions" || !contract.questionsEnabled) {
      return;
    }

    let focusFrameId: number | undefined;
    const selectionFrameId = window.requestAnimationFrame(() => {
      if (isDesktopLayout) {
        setDesktopActiveTab("questions");
      } else {
        setMobileActiveTab("questions");
      }

      focusFrameId = window.requestAnimationFrame(() => {
        const questionsTab = document.getElementById("contract-tab-questions");
        questionsTab?.scrollIntoView({ behavior: "smooth", block: "center" });
        questionsTab?.focus({ preventScroll: true });
        onSectionFocused?.();
      });
    });

    return () => {
      window.cancelAnimationFrame(selectionFrameId);
      if (focusFrameId !== undefined) {
        window.cancelAnimationFrame(focusFrameId);
      }
    };
  }, [
    contract.questionsEnabled,
    focusSection,
    isDesktopLayout,
    onSectionFocused,
  ]);

  useEffect(() => {
    const timeoutId = window.setTimeout(
      () => {
        if (!canShowShareHint) {
          setIsShareHintOpen(false);
          return;
        }

        try {
          setIsShareHintOpen(localStorage.getItem(shareHintStorageKey) !== "dismissed");
        } catch {
          setIsShareHintOpen(true);
        }
      },
      canShowShareHint ? 450 : 0,
    );

    return () => window.clearTimeout(timeoutId);
  }, [canShowShareHint, shareHintStorageKey]);

  const dismissShareHint = useCallback(() => {
    setIsShareHintOpen(false);
    try {
      localStorage.setItem(shareHintStorageKey, "dismissed");
    } catch {
      // The hint still closes when storage is unavailable.
    }
  }, [shareHintStorageKey]);
  const questionsQuery = useQuery({
    queryKey: contractQuestionQueryKeys.byContract(contract.slug),
    queryFn: () => contractQuestionsClient.getByContract(contract.slug),
    enabled: Boolean(contract.questionsEnabled),
  });
  const questionItems = questionsQuery.data?.items ?? [];
  const reviewGroups = (contract.reviews ?? []).reduce<Record<number, ContractDto["reviews"]>>(
    (accumulator, review) => {
      const reviews = accumulator[review.dealId] ?? [];
      reviews.push(review);
      accumulator[review.dealId] = reviews;
      return accumulator;
    },
    {},
  );
  const groupedReviews = Object.entries(reviewGroups).map(([dealId, reviews]) => ({
    dealId: Number(dealId),
    reviews: [...(reviews ?? [])].sort((left, right) => {
      const leftPriority =
        left.reviewedUserId === contract.authorId ? 0 : left.reviewerId === contract.authorId ? 1 : 2;
      const rightPriority =
        right.reviewedUserId === contract.authorId
          ? 0
          : right.reviewerId === contract.authorId
            ? 1
            : 2;

      return leftPriority - rightPriority;
    }),
  }));
  const openDealsCount = contract._count?.deals ?? 0;
  const completedDealsCount = contract.completedDealsCount ?? 0;
  const viewsCount = contract.uniqueViewsCount ?? 0;
  const categoryLabel = getCategoryLabel(contract.category, locale) ?? contract.category;
  const isAuthenticated = typeof viewerId === "number" && viewerId > 0;
  const mobileTabs: Array<{ id: ContractTabId; label: string; count?: number }> = [
    { id: "details", label: tDetails("Details") },
    ...(contract.questionsEnabled
      ? [{ id: "questions" as const, label: tDetails("Questions"), count: questionItems.length }]
      : []),
    { id: "reviews", label: tDetails("Reviews"), count: contract.reviewsCount ?? 0 },
  ];
  const desktopTabs = mobileTabs.filter(
    (tab): tab is { id: DesktopContractTabId; label: string; count?: number } =>
      tab.id !== "details",
  );
  const resolvedDesktopActiveTab =
    !contract.questionsEnabled && desktopActiveTab === "questions"
      ? "reviews"
      : desktopActiveTab;
  const activeTab = isDesktopLayout
    ? resolvedDesktopActiveTab
    : mobileActiveTab;
  const tabs = isDesktopLayout ? desktopTabs : mobileTabs;

  const handleTabChange = (tab: ContractTabId) => {
    if (isDesktopLayout) {
      if (tab !== "details") {
        setDesktopActiveTab(tab);
      }
      return;
    }

    setMobileActiveTab(tab);
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px] xl:items-start">
      <SurfaceCard
        paddingClassName="p-0"
        className="relative flex flex-col overflow-hidden rounded-[2rem] xl:contents"
      >
        <div className="contents xl:col-start-1 xl:row-span-2 xl:row-start-1 xl:block xl:min-w-0">
          <div className="relative order-1 overflow-hidden xl:rounded-[2rem] xl:border xl:border-[var(--border-soft)] xl:bg-[var(--surface)] xl:shadow-[var(--shadow-soft)]">
            {showFavoriteAction || shareUrl ? (
              <div className="absolute right-3 top-3 z-20 flex shrink-0 items-center gap-2 sm:right-5 sm:top-5">
                {showFavoriteAction ? (
                  <ToggleContractFavoriteButton
                    contract={contract}
                    isAuthenticated={isAuthenticated}
                    isAuthenticationPending={isViewerLoading}
                    onAuthRequired={onFavoriteAuthRequired}
                  />
                ) : null}
                {shareUrl ? (
                  <ContextualHint
                    isOpen={isShareHintOpen}
                    onDismiss={dismissShareHint}
                    title={tDetails("ShareHintTitle")}
                    description={tDetails("ShareHintDescription")}
                    dismissLabel={tDetails("DismissShareHint")}
                  >
                    <TelegramStoryShareButton
                      url={shareUrl}
                      text={buildContractShareText(contract, locale, { categoryLabel })}
                      preparedMessage={{ type: "contract", slug: contract.slug }}
                      variant="overlay"
                      onOpen={dismissShareHint}
                      story={{
                        type: "contract",
                        url: shareUrl,
                        title: contract.title,
                        description: contract.description,
                        imageUrl: contract.mediaRefs?.[0] ?? null,
                        categoryLabel,
                        tags: contract.tags,
                        price:
                          contract.basePrice === null || contract.basePrice === ""
                            ? null
                            : formatCurrency(contract.basePrice, localeCode),
                        currency: "",
                        deadlineDays: contract.deadlineDays,
                        openDealsCount,
                        completedDealsCount,
                        viewsCount,
                        rating: contract.averageRating,
                      }}
                    />
                  </ContextualHint>
                ) : null}
              </div>
            ) : null}

            <div className="h-[23rem] min-h-72 overflow-hidden sm:h-[30rem]">
              <DynamicContractImage
                initialMediaRefs={contract.mediaRefs}
                contractSlug={contract.slug}
                alt={contract.title}
                multiple
                className="block h-full w-full overflow-hidden"
                imageClassName="h-full w-full object-cover"
              />
            </div>
          </div>

          <div className="contents xl:mt-4 xl:block xl:rounded-[2rem] xl:border xl:border-[var(--border-soft)] xl:bg-[var(--surface)] xl:p-6 xl:shadow-[var(--shadow-soft)]">
            <div className="order-3 whitespace-pre-wrap px-4 pt-4 text-sm font-medium leading-7 text-zinc-600 sm:px-6 sm:pt-6 sm:text-[15px] xl:p-0">
              {contract.description}
            </div>

            <div className="order-7 px-4 pb-4 pt-6 sm:px-6 sm:pb-6 xl:p-0 xl:pt-6">
              <ContractSectionTabs
                activeTab={activeTab}
                items={tabs}
                label={tDetails("Sections")}
                onChange={handleTabChange}
              />
              {activeTab !== "details" ? (
                <div
                  id={`contract-panel-${activeTab}`}
                  role="tabpanel"
                  aria-labelledby={`contract-tab-${activeTab}`}
                  className="mt-5"
                >
                  {activeTab === "questions" && contract.questionsEnabled ? (
                    <ContractQuestionsPanel
                      slug={contract.slug}
                      authorId={contract.authorId}
                      viewerId={viewerId}
                      isViewerLoading={isViewerLoading}
                      questions={questionItems}
                      onAuthRequired={onQuestionAuthRequired}
                    />
                  ) : null}
                  {activeTab === "reviews" ? (
                    <ReviewsPanel
                      contract={contract}
                      groupedReviews={groupedReviews}
                      t={t}
                      tDetails={tDetails}
                    />
                  ) : null}
                </div>
              ) : null}
            </div>

            {contract.moderationComment ? (
              <div className="order-9 px-4 pb-4 sm:px-6 sm:pb-6 xl:mt-6 xl:p-0">
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-200">
                  <p className="font-bold">{tDetails("ModerationComment")}</p>
                  <p className="mt-2 leading-6">{contract.moderationComment}</p>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <aside className="contents xl:sticky xl:top-6 xl:col-start-2 xl:row-start-1 xl:block xl:self-start xl:rounded-[2rem] xl:border xl:border-[var(--border-soft)] xl:bg-[var(--surface)] xl:p-5 xl:shadow-[var(--shadow-soft)]">
          <div className="order-2 px-4 pt-4 sm:px-6 sm:pt-6 xl:p-0">
            <div className="flex flex-wrap items-center gap-2">
              {showStatus && contract.status !== "active" ? (
                <StatusPill
                  label={tSearch(`status_${contract.status}`)}
                  tone={statusMeta.tone}
                />
              ) : null}
              {categoryLabel ? <DetailChip>{categoryLabel}</DetailChip> : null}
              <DealTypeBadge isEscrow={contract.isEscrow} />
            </div>
            <h1
              className={`${unbounded.className} mt-3 text-2xl font-extrabold leading-tight tracking-[-0.04em] text-zinc-950 sm:text-3xl`}
            >
              {contract.title}
            </h1>
          </div>

          <div className="order-4 mt-6 px-4 sm:px-6 xl:px-0">
            <ContractTerms
              contract={contract}
              localeCode={localeCode}
              size="details"
              className="xl:[&>div:first-child]:px-3 xl:[&>div:last-child]:px-3 xl:[&>div>p:first-child]:text-3xl"
            />
          </div>

          <div className="order-5 mx-4 mt-3 grid grid-cols-2 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 text-xs font-medium text-zinc-600 dark:border-white/12 sm:mx-6 xl:mx-0">
            <InfoCell icon={<PeopleIcon />}>{t("OpenDealsValue", { count: openDealsCount })}</InfoCell>
            <InfoCell icon={<CompletedIcon />} dividerLeft>
              {t("CompletedDealsValue", { count: completedDealsCount })}
            </InfoCell>
            <InfoCell icon={<EyeIcon />} dividerTop>
              {t("ViewsValue", { count: viewsCount })}
            </InfoCell>
            <InfoCell
              icon={<RatingStars value={contract.averageRating ?? 0} size="sm" variant="compact" showValue={false} />}
              dividerLeft
              dividerTop
            >
              {contract.averageRating
                ? t("RatingValue", {
                    rating: contract.averageRating.toFixed(1),
                    count: contract.reviewsCount ?? 0,
                  })
                : t("NoRatings")}
            </InfoCell>
          </div>

          <div
            id={isDesktopLayout ? undefined : "contract-panel-details"}
            role={isDesktopLayout ? undefined : "tabpanel"}
            aria-labelledby={isDesktopLayout ? undefined : "contract-tab-details"}
            className={`${mobileActiveTab === "details" ? "block" : "hidden"} order-8 mx-4 mb-4 mt-5 sm:mx-6 sm:mb-6 xl:mx-0 xl:mb-0 xl:mt-6 xl:block`}
          >
            <ContractMeta
              contract={contract}
              localeCode={localeCode}
              tDetails={tDetails}
            />
          </div>

          {primaryAction ? (
            <div className="hidden xl:mt-3 xl:block">{primaryAction}</div>
          ) : null}

          {contract.tags.length > 0 ? (
            <div className="order-6 mx-4 mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-zinc-500 sm:mx-6 xl:mx-0">
              {contract.tags.map((tag) => (
                <span key={tag}>#{tag}</span>
              ))}
            </div>
          ) : null}
        </aside>
      </SurfaceCard>

      {sidebarFooter ? (
        <div className="flex flex-col gap-4 xl:col-start-2 xl:row-start-2">
          {sidebarFooter}
        </div>
      ) : null}
    </div>
  );
}

function ContractSectionTabs({
  activeTab,
  items,
  label,
  onChange,
}: {
  activeTab: ContractTabId;
  items: Array<{ id: ContractTabId; label: string; count?: number }>;
  label: string;
  onChange: (tab: ContractTabId) => void;
}) {
  const icons = { details: FileText, questions: MessageCircleQuestion, reviews: Star };
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const direction = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!direction) return;
    event.preventDefault();
    const nextIndex = (index + direction + items.length) % items.length;
    onChange(items[nextIndex].id);
    document.getElementById(`contract-tab-${items[nextIndex].id}`)?.focus();
  };

  return (
    <div className="theme-surface overflow-hidden rounded-[1.75rem] border p-1.5 shadow-[0_12px_32px_rgba(9,9,11,0.08)]">
      <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item, index) => {
          const Icon = icons[item.id];
          const isActive = item.id === activeTab;
          return (
            <button
              key={item.id}
              id={`contract-tab-${item.id}`}
              type="button"
              role="tab"
              aria-controls={`contract-panel-${item.id}`}
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onChange(item.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={`inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-[1.35rem] px-3.5 text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-blue-500 sm:h-14 sm:px-5 md:flex-1 ${
                isActive
                  ? "bg-zinc-950 text-white shadow-md dark:bg-zinc-800"
                  : "text-zinc-500 hover:bg-white/70 hover:text-zinc-950 dark:hover:bg-white/5"
              }`}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
              <span>{item.label}</span>
              {item.count !== undefined ? (
                <span className={`min-w-6 rounded-full px-1.5 py-0.5 text-center text-[11px] ${isActive ? "bg-white/15 text-white" : "bg-zinc-200/80 text-zinc-600 dark:bg-white/10"}`}>
                  {item.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ContractMeta({ contract, localeCode, tDetails }: { contract: ContractDto; localeCode: string; tDetails: ReturnType<typeof useTranslations<"ContractDetails">> }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 dark:border-white/12">
      <div className="grid sm:grid-cols-2">
        <MetaCell icon={<UserIcon />} label={tDetails("Author")}>{getAuthorValue(contract, tDetails("NotSpecified"), tDetails("Hidden"))}</MetaCell>
        <MetaCell icon={<PeopleIcon />} label={tDetails("Telegram")} dividerLeft>{getTelegramValue(contract, tDetails("NotSpecified"), tDetails("Hidden"))}</MetaCell>
        <MetaCell icon={<CalendarIcon />} label={tDetails("Created")} dividerTop>{formatDateTime(contract.createdAt, localeCode)}</MetaCell>
        <MetaCell icon={<EyeIcon />} label={tDetails("Source")} dividerLeft dividerTop>
          {getSourceValue(
            contract,
            tDetails("OpenOriginalPost"),
            tDetails("NotSpecified"),
            tDetails("Hidden"),
          )}
        </MetaCell>
        {contract.scout ? <MetaCell icon={<UserIcon />} label={tDetails("AddedByScout")} dividerTop>{contract.scout.name ?? tDetails("Unnamed")}</MetaCell> : null}
      </div>
    </div>
  );
}

function ReviewsPanel({ contract, groupedReviews, t, tDetails }: { contract: ContractDto; groupedReviews: Array<{ dealId: number; reviews: NonNullable<ContractDto["reviews"]> }>; t: ReturnType<typeof useTranslations<"Contracts">>; tDetails: ReturnType<typeof useTranslations<"ContractDetails">> }) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold text-zinc-950">{tDetails("Reviews")}</h2>
        <div className="text-sm font-semibold text-zinc-600">
          {contract.averageRating ? t("RatingValue", { rating: contract.averageRating.toFixed(1), count: contract.reviewsCount ?? 0 }) : t("NoRatings")}
        </div>
      </div>
      {groupedReviews.length ? (
        <div className="mt-5 grid gap-5">
          {groupedReviews.map((group, groupIndex) => (
            <div key={group.dealId} className={groupIndex > 0 ? "border-t border-zinc-200 pt-5 dark:border-white/10" : ""}>
              <h3 className="text-base font-extrabold text-zinc-950">{tDetails("DealNumber", { id: group.dealId })}</h3>
              <div className="mt-4 grid gap-3">
                {group.reviews.map((review) => <ReviewCard key={review.id} review={review} title={getReviewTitle(review, contract.authorId, tDetails)} />)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-white/12">{tDetails("NoReviews")}</p>
      )}
    </div>
  );
}

function DetailChip({ children }: { children: ReactNode }) {
  return <span className="inline-flex rounded-full border border-zinc-200 bg-white/75 px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:border-white/12 dark:bg-zinc-900/80 dark:text-zinc-100">{children}</span>;
}

function InfoCell({ icon, children, dividerLeft = false, dividerTop = false }: { icon: ReactNode; children: ReactNode; dividerLeft?: boolean; dividerTop?: boolean }) {
  return <div className={`flex min-w-0 items-center gap-2.5 px-3 py-4 sm:px-4 ${dividerLeft ? "border-l border-zinc-200 dark:border-white/12" : ""} ${dividerTop ? "border-t border-zinc-200 dark:border-white/12" : ""}`}><span className="h-5 w-5 shrink-0 text-zinc-500 [&>svg]:h-full [&>svg]:w-full">{icon}</span><span className="min-w-0 leading-4">{children}</span></div>;
}

function MetaCell({ icon, label, children, dividerLeft = false, dividerTop = false }: { icon: ReactNode; label: string; children: ReactNode; dividerLeft?: boolean; dividerTop?: boolean }) {
  return <div className={`flex min-w-0 items-start gap-3 px-4 py-4 ${dividerLeft ? (dividerTop ? "border-l border-t border-zinc-200 dark:border-white/12" : "border-t border-zinc-200 dark:border-white/12 sm:border-l sm:border-t-0") : dividerTop ? "border-t border-zinc-200 dark:border-white/12" : ""}`}><span className="mt-0.5 h-5 w-5 shrink-0 text-zinc-500 [&>svg]:h-full [&>svg]:w-full">{icon}</span><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{label}</p><div className="mt-1 break-words text-sm font-semibold text-zinc-900">{children}</div></div></div>;
}

function getAuthorValue(contract: ContractDto, fallback: string, hidden: string) {
  if (!contract.isRevealed) return <span className="text-zinc-500">{hidden}</span>;
  if (contract.scoutId != null && contract.authorId === contract.scoutId) return contract.scoutedTelegramUsername ? `@${contract.scoutedTelegramUsername.replace(/^@/, "")}` : fallback;
  return <Link href={routes.profileBySlug(getUserProfileSlug({ id: contract.author?.id ?? contract.authorId, telegramUsername: contract.author?.telegramUsername }))} className="transition hover:text-zinc-600">{contract.author?.name ?? fallback}</Link>;
}

function getTelegramValue(contract: ContractDto, fallback: string, hidden: string) {
  if (!contract.isRevealed) return <span className="text-zinc-500">{hidden}</span>;
  if (contract.scoutId != null && contract.authorId === contract.scoutId) return contract.scoutedTelegramUsername ? `@${contract.scoutedTelegramUsername.replace(/^@/, "")}` : fallback;
  return contract.author?.telegramUsername ? `@${contract.author.telegramUsername}` : fallback;
}

function getSourceValue(
  contract: ContractDto,
  openLabel: string,
  fallback: string,
  hidden: string,
) {
  if (!contract.isRevealed) {
    return <span className="text-zinc-500">{hidden}</span>;
  }

  if (!contract.telegramPostUrl) {
    return fallback;
  }

  return (
    <Button
      href={contract.telegramPostUrl}
      target="_blank"
      rel="noreferrer"
      variant="secondary"
      size="sm"
      shape="rounded-xl"
    >
      {openLabel}
      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
    </Button>
  );
}

function getReviewTitle(review: NonNullable<ContractDto["reviews"]>[number], contractAuthorId: number, t: ReturnType<typeof useTranslations<"ContractDetails">>) {
  if (review.reviewedUserId === contractAuthorId) return t("ReviewToAuthor");
  if (review.reviewerId === contractAuthorId) return t("AuthorCounterReview");
  return t("DealReview");
}
