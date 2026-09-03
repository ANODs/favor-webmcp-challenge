import { Unbounded } from "next/font/google";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";

import {
  buildContractShareText,
  contractStatusMeta,
  type ContractAuthorDto,
  type ContractDto,
} from "@/entities/contract";
import {
  ContractTerms,
  DynamicContractImage,
} from "@/entities/contract/ui";
import { getCategoryLabel } from "@/entities/category";
import { ToggleContractFavoriteButton } from "@/features/toggle-contract-favorite";
import { TelegramStoryShareButton } from "@/features/share-telegram-story";
import { Link } from "@/i18n/routing";
import { routes } from "@/shared/config/routes";
import { formatCurrency } from "@/shared/lib/format";
import { buildContractStartParam, buildTelegramMiniAppUrl } from "@/shared/lib/telegram";
import {
  CompletedIcon,
  DealTypeBadge,
  EyeIcon,
  PeopleIcon,
  RatingStars,
  StatusPill,
  SurfaceCard,
} from "@/shared/ui";

const unbounded = Unbounded({ subsets: ["latin", "cyrillic"] });

type Props = {
  contract: ContractDto;
  action?: ReactNode;
  viewerId?: number | null;
  viewerRole?: ContractAuthorDto["role"];
  viewerTelegramId?: string | bigint | number | null;
  botUsername?: string;
  showFavoriteAction?: boolean;
  isViewerLoading?: boolean;
  onFavoriteAuthRequired?: () => void;
};

export function ContractCard({
  contract,
  action,
  viewerId,
  viewerRole,
  viewerTelegramId,
  botUsername,
  showFavoriteAction = false,
  isViewerLoading = false,
  onFavoriteAuthRequired,
}: Props) {
  const t = useTranslations("Contracts");
  const tSearch = useTranslations("SearchFilter");
  const locale = useLocale() as "ru" | "en";
  const statusMeta = contractStatusMeta[contract.status];
  const canSeeStatus = viewerRole === "moderator" || viewerId === contract.authorId;
  const shareUrl = botUsername
    ? buildTelegramMiniAppUrl(
        botUsername,
        buildContractStartParam(contract.slug, viewerTelegramId),
      )
    : null;
  const isAuthenticated = typeof viewerId === "number" && viewerId > 0;
  const openDealsCount = contract._count?.deals ?? 0;
  const completedDealsCount = contract.completedDealsCount ?? 0;
  const viewsCount = contract.uniqueViewsCount ?? 0;
  const localeCode = locale === "en" ? "en-US" : "ru-RU";
  const categoryLabel = getCategoryLabel(contract.category, locale) ?? contract.category;

  return (
    <SurfaceCard
      id={`contract-${contract.id}`}
      paddingClassName="p-0"
      className="group relative scroll-mt-24 overflow-hidden rounded-[2rem] transition duration-200 hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-lg dark:hover:border-white/15"
    >
      {showFavoriteAction || shareUrl ? (
        <div className="absolute right-3 top-3 z-20 flex items-center gap-2 sm:right-4 sm:top-4">
          {showFavoriteAction ? (
            <ToggleContractFavoriteButton
              contract={contract}
              isAuthenticated={isAuthenticated}
              isAuthenticationPending={isViewerLoading}
              onAuthRequired={onFavoriteAuthRequired}
            />
          ) : null}
          {shareUrl ? (
            <TelegramStoryShareButton
              url={shareUrl}
              text={buildContractShareText(contract, locale, { categoryLabel })}
              preparedMessage={{ type: "contract", slug: contract.slug }}
              variant="overlay"
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
          ) : null}
        </div>
      ) : null}

      <Link
        href={routes.contractBySlug(contract.slug)}
        aria-label={contract.title}
        className="block outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--foreground)]"
      >
        <div className="sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(18rem,38%)]">
          <div className="aspect-square min-h-0 w-full overflow-hidden sm:col-start-2 sm:row-start-1 sm:h-full sm:aspect-auto sm:min-h-[460px]">
            <DynamicContractImage
              initialMediaRefs={contract.mediaRefs}
              contractSlug={contract.slug}
              alt={contract.title}
              className="block h-full w-full overflow-hidden"
              imageClassName="h-full w-full object-cover"
              previewEnabled={false}
            />
          </div>

          <div className="min-w-0 p-4 sm:col-start-1 sm:row-start-1 sm:flex sm:min-h-[460px] sm:flex-col sm:p-6">
            <div className="flex flex-wrap items-center gap-2 pr-24 sm:pr-0">
              {categoryLabel ? <ContractChip>{categoryLabel}</ContractChip> : null}
              <DealTypeBadge isEscrow={contract.isEscrow} />
              {canSeeStatus && contract.status !== "active" ? (
                <StatusPill
                  label={tSearch(`status_${contract.status}`)}
                  tone={statusMeta.tone}
                />
              ) : null}
            </div>

            <div className="mt-5">
              <h2
                className={`${unbounded.className} text-lg font-extrabold leading-tight tracking-[-0.035em] text-zinc-950 sm:text-xl lg:text-2xl`}
              >
                {contract.title}
              </h2>
              <p className="mt-3 line-clamp-3 text-sm font-medium leading-6 text-zinc-600 sm:min-h-[4.5rem]">
                {contract.description}
              </p>
            </div>

            <ContractTerms
              contract={contract}
              className="mt-5"
              localeCode={localeCode}
            />

            <div className="mt-3 grid grid-cols-2 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 text-[11px] font-medium text-zinc-600 dark:border-white/12 sm:text-xs">
              <ContractStat icon={<PeopleIcon />}>
                {t("OpenDealsValue", { count: openDealsCount })}
              </ContractStat>
              <ContractStat icon={<CompletedIcon />} className="border-l border-zinc-200 dark:border-white/12">
                {t("CompletedDealsValue", { count: completedDealsCount })}
              </ContractStat>
              <ContractStat icon={<EyeIcon />} className="border-t border-zinc-200 dark:border-white/12">
                {t("ViewsValue", { count: viewsCount })}
              </ContractStat>
              <ContractStat
                icon={
                  <RatingStars
                    value={contract.averageRating ?? 0}
                    size="sm"
                    variant="compact"
                    showValue={false}
                  />
                }
                className="border-l border-t border-zinc-200 dark:border-white/12"
              >
                {contract.averageRating
                  ? t("RatingValue", {
                      rating: contract.averageRating.toFixed(1),
                      count: contract.reviewsCount ?? 0,
                    })
                  : t("NoRatings")}
              </ContractStat>
            </div>

            {contract.tags.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[11px] font-semibold text-zinc-500 sm:mt-auto sm:pt-4 sm:text-xs">
                {contract.tags.map((tag) => (
                  <span key={tag}>#{tag}</span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </Link>

      {action ? (
        <div className="border-t border-zinc-200 p-4 dark:border-white/10 sm:p-6">
          {action}
        </div>
      ) : null}
    </SurfaceCard>
  );
}

function ContractChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex rounded-full border border-zinc-200 bg-white/75 px-3 py-1.5 text-xs font-semibold text-zinc-700 backdrop-blur-sm dark:border-white/12 dark:bg-zinc-900/80 dark:text-zinc-100">
      {children}
    </span>
  );
}

function ContractStat({
  icon,
  children,
  className = "",
}: {
  icon: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex min-w-0 items-center gap-2.5 px-3 py-3.5 sm:px-4 ${className}`}>
      <span className="h-5 w-5 shrink-0 text-zinc-500 [&>svg]:h-full [&>svg]:w-full">
        {icon}
      </span>
      <span className="min-w-0 leading-4">{children}</span>
    </div>
  );
}
