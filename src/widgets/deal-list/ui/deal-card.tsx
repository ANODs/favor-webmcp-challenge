import type { ReactNode } from "react";
import { Unbounded } from "next/font/google";
import { Link } from "@/i18n/routing";
import { routes } from "@/shared/config/routes";
import type { DealDto } from "@/entities/deal";
import { dealStatusMeta, getParticipantRole } from "@/entities/deal";
import { formatCompactDate, formatCurrency } from "@/shared/lib/format";
import { getUserProfileSlug } from "@/shared/lib/profile";
import { StatusPill } from "@/shared/ui/status-pill";
import {
  DealTypeBadge,
  PeopleIcon,
  SurfaceCard,
} from "@/shared/ui";
import { DynamicContractImage } from "@/entities/contract/ui";
import { useTranslations, useLocale } from "next-intl";

const unbounded = Unbounded({ subsets: ["latin", "cyrillic"] });

type Props = {
  deal: DealDto;
  currentUserId?: number | null;
  isModerator?: boolean;
};

export function DealCard({ deal, currentUserId, isModerator }: Props) {
  const t = useTranslations("Deals");
  const tContracts = useTranslations("Contracts");
  const tStatus = useTranslations("DealStatuses");
  const tDetails = useTranslations("DealDetails");
  const locale = useLocale();
  const localeCode = locale === "en" ? "en-US" : "ru-RU";
  const statusMeta = dealStatusMeta[deal.status];
  const role = getParticipantRole(deal, currentUserId);
  const mediaRefs = deal.contract?.mediaRefs ?? deal.contractSnapshot?.mediaRefs;
  const contractSlug = deal.contract?.slug ?? deal.contractSnapshot?.slug;
  const roleLabel =
    role === "customer"
      ? t("YouAreCustomer")
      : role === "freelancer"
        ? t("YouAreFreelancer")
        : isModerator
          ? t("ModeratorArbitration")
          : null;
  const getParticipantLink = (user: { id: number; name: string | null; telegramUsername: string | null } | null | undefined, fallbackLabel: string) => {
    if (!user) {
      return <span className="text-zinc-950 font-medium">{fallbackLabel}</span>;
    }
    const value = user.telegramUsername ? `@${user.telegramUsername}` : user.name || fallbackLabel;
    return (
      <Link
        href={routes.profileBySlug(getUserProfileSlug({
          id: user.id,
          telegramUsername: user.telegramUsername,
        }))}
        onClick={(e) => e.stopPropagation()}
        className="inline-flex font-medium text-zinc-900 transition hover:text-zinc-600"
      >
        {value}
      </Link>
    );
  };

  const paymentMethod = deal.isEscrow
    ? deal.escrowCurrency ?? "TON" // Fallback to TON if missing but isEscrow is true
    : tContracts("DirectPaymentMethod");

  return (
    <SurfaceCard
      id={`deal-${deal.id}`}
      paddingClassName="p-0"
      className="group relative scroll-mt-24 overflow-hidden rounded-[2rem] transition duration-200 hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-lg dark:hover:border-white/15"
    >
      <div className="absolute right-3 top-3 z-10 sm:right-5 sm:top-5">
        <StatusPill label={tStatus(statusMeta.labelKey)} tone={statusMeta.tone} />
      </div>

      <Link
        href={routes.dealById(deal.id)}
        aria-label={t("DealTitle", { id: deal.id })}
        className="block outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--foreground)]"
      >
        <div className="sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(18rem,38%)]">
          <div className="aspect-square min-h-0 w-full overflow-hidden sm:col-start-2 sm:row-start-1 sm:h-full sm:aspect-auto sm:min-h-[460px]">
            {((mediaRefs?.length ?? 0) > 0 || contractSlug) ? (
              <DynamicContractImage
                initialMediaRefs={mediaRefs}
                contractSlug={contractSlug!}
                alt={deal.contract?.title ?? deal.contractSnapshot?.title ?? t("DealTitle", { id: deal.id })}
                className="block h-full w-full overflow-hidden"
                imageClassName="h-full w-full object-cover"
                previewEnabled={false}
              />
            ) : (
              <div className="h-full w-full bg-zinc-100 dark:bg-white/5" />
            )}
          </div>

          <div className="min-w-0 p-4 sm:col-start-1 sm:row-start-1 sm:flex sm:min-h-[460px] sm:flex-col sm:p-6">
            <div className="flex flex-wrap items-center gap-2 pr-24 sm:pr-0">
              {roleLabel ? (
                <DealChip>{roleLabel}</DealChip>
              ) : null}
              <DealTypeBadge isEscrow={deal.isEscrow} />
            </div>

              <div className="mt-5">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500 mb-2">
                  {deal.contract?.title ?? deal.contractSnapshot?.title ?? t("ContractNoTitle")}
                </p>
                <h2 className="text-lg font-extrabold leading-tight tracking-[-0.035em] text-zinc-950 sm:text-xl lg:text-2xl">
                  {t("DealTitle", { id: deal.id })}
                </h2>
                {deal.details ? (
                  <p className="mt-3 line-clamp-3 text-sm font-medium leading-6 text-zinc-600 sm:min-h-[4.5rem]">
                    {deal.details}
                  </p>
                ) : null}
              </div>

            <div className="relative mt-5 grid grid-cols-2 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 dark:border-white/12">
              <div className="min-w-0 px-4 py-4 sm:px-5">
                <p className={`${unbounded.className} truncate text-2xl font-extrabold tracking-[-0.04em] text-zinc-950 sm:text-3xl`}>
                  {formatCurrency(deal.price, localeCode)}
                </p>
                <p className="mt-1.5 truncate text-[11px] font-medium text-zinc-500 sm:text-xs">
                  {tContracts("PaymentMethod")}: {" "}
                  <span className="font-bold text-[#0f8c5c] dark:text-brand-accent">
                    {paymentMethod}
                  </span>
                </p>
              </div>
              <div className="absolute left-1/2 top-4 bottom-4 w-[1px] -translate-x-1/2 bg-zinc-200 dark:bg-white/12"></div>
              <div className="min-w-0 px-4 py-4 text-center sm:px-5">
                <p className={`${unbounded.className} truncate text-2xl font-extrabold tracking-[-0.04em] text-zinc-950 sm:text-3xl`}>
                  {deal.deadlineDays ? t("DeadlineDays", { days: deal.deadlineDays }) : t("NoDeadline")}
                </p>
                <p className="mt-1.5 truncate text-[11px] font-medium text-zinc-500 sm:text-xs">
                  {tContracts("DeadlineLabel")}
                </p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 text-[11px] font-medium text-zinc-600 dark:border-white/12 sm:text-xs">
                <div className="flex min-w-0 items-center gap-2.5 px-3 py-3.5 sm:px-4">
                  <span className="h-5 w-5 shrink-0 text-zinc-500 [&>svg]:h-full [&>svg]:w-full">
                    <PeopleIcon />
                  </span>
                  <div className="min-w-0 flex flex-col gap-0.5 leading-tight">
                    <span className="truncate text-zinc-500 text-[10px] uppercase tracking-wider">{tDetails("customer")}</span>
                    <span className="truncate">{getParticipantLink(deal.customer, tDetails("not_specified"))}</span>
                  </div>
                </div>
                <div className="flex min-w-0 items-center gap-2.5 px-3 py-3.5 sm:px-4 border-l border-zinc-200 dark:border-white/12">
                  <span className="h-5 w-5 shrink-0 text-zinc-500 [&>svg]:h-full [&>svg]:w-full">
                    <PeopleIcon />
                  </span>
                  <div className="min-w-0 flex flex-col gap-0.5 leading-tight">
                    <span className="truncate text-zinc-500 text-[10px] uppercase tracking-wider">{tDetails("freelancer")}</span>
                    <span className="truncate">{getParticipantLink(deal.freelancer, tDetails("not_specified"))}</span>
                  </div>
                </div>
                <div className="flex min-w-0 items-center gap-2.5 px-3 py-3.5 sm:px-4 border-t border-zinc-200 dark:border-white/12">
                  <span className="h-5 w-5 shrink-0 text-zinc-500 [&>svg]:h-full [&>svg]:w-full">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </span>
                  <span className="min-w-0 leading-4">{deal.contract ? t("WithContract") : deal.contractSnapshot ? t("DeletedContract") : t("NoContract")}</span>
                </div>
                <div className="flex min-w-0 items-center gap-2.5 px-3 py-3.5 sm:px-4 border-l border-t border-zinc-200 dark:border-white/12">
                  <span className="h-5 w-5 shrink-0 text-zinc-500 [&>svg]:h-full [&>svg]:w-full">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M8 2V6M16 2V6M3 10H21M5 4H19C20.1046 4 21 4.89543 21 6V20C21 21.1046 20.1046 22 19 22H5C3.89543 22 3 21.1046 3 20V6C3 4.89543 3.89543 4 5 4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </span>
                  <span className="min-w-0 leading-4">{formatCompactDate(deal.updatedAt, locale)}</span>
                </div>
              </div>
          </div>
        </div>
      </Link>
    </SurfaceCard>
  );
}

function DealChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex rounded-full border border-zinc-200 bg-white/75 px-3 py-1.5 text-xs font-semibold text-zinc-700 backdrop-blur-sm dark:border-white/12 dark:bg-zinc-900/80 dark:text-zinc-100">
      {children}
    </span>
  );
}
