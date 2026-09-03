import { Unbounded } from "next/font/google";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { DynamicContractImage } from "@/entities/contract/ui";
import { dealStatusMeta, getDealTimeStatus, type DealDto } from "@/entities/deal";
import { Link } from "@/i18n/routing";
import { routes } from "@/shared/config/routes";
import { formatCurrency, formatDateTime, formatDurationMinutes, formatTimeRemaining } from "@/shared/lib/format";
import { getUserProfileSlug } from "@/shared/lib/profile";
import {
  CalendarIcon,
  DealTypeBadge,
  DocumentIcon,
  EntityShowcaseCard,
  PeopleIcon,
  StatusPill,
  UserIcon,
} from "@/shared/ui";

const unbounded = Unbounded({ subsets: ["latin", "cyrillic"] });

type Props = {
  deal: DealDto;
  isCustomer: boolean;
  now: number | null;
};

export function DealHeader({ deal, isCustomer, now }: Props) {
  const t = useTranslations("DealDetails");
  const tStatus = useTranslations("DealStatuses");
  const tDeals = useTranslations("Deals");
  const tContracts = useTranslations("Contracts");
  const locale = useLocale();
  const localeCode = locale === "en" ? "en-US" : "ru-RU";
  const mediaRefs = deal.contract?.mediaRefs ?? deal.contractSnapshot?.mediaRefs;
  const contractSlug = deal.contract?.slug ?? deal.contractSnapshot?.slug;
  const contractTitle = deal.contract?.title ?? deal.contractSnapshot?.title ?? tDeals("NoContract");
  const paymentMethod = deal.isEscrow
    ? deal.escrowCurrency
    : tContracts("DirectPaymentMethod");

  const timeStatus = getDealTimeStatus(deal, now ?? 0);

  return (
    <EntityShowcaseCard
      badges={
        <>
          <StatusPill
            label={tStatus(dealStatusMeta[deal.status].labelKey)}
            tone={dealStatusMeta[deal.status].tone}
          />
          {now !== null && timeStatus.isAwaitingPayment && deal.paymentExpiresAt ? (
            <StatusPill
              label={`${t("payment_expires_in")}: ${formatTimeRemaining(deal.paymentExpiresAt, locale, now)}`}
              tone={timeStatus.isPaymentExpiringSoon ? "danger" : "warning"}
            />
          ) : null}
          {timeStatus.isOverdue ? (
            <StatusPill
              label={t("overdue")}
              tone="danger"
            />
          ) : null}
          <DealTypeBadge isEscrow={deal.isEscrow} />
        </>
      }
      media={
        (mediaRefs?.length ?? 0) > 0 || contractSlug ? (
          <DynamicContractImage
            initialMediaRefs={mediaRefs}
            contractSlug={contractSlug ?? `deal-${deal.id}`}
            alt={contractTitle}
            className="block h-72 w-full overflow-hidden sm:h-80"
            imageClassName="h-full w-full object-cover"
          />
        ) : null
      }
      eyebrow={contractTitle}
      title={tDeals("DealTitle", { id: deal.id })}
      titleAs="h1"
      description={deal.details}
      metrics={
        <>
          <div className="relative grid grid-cols-2 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 dark:border-white/12">
            <div className="min-w-0 px-4 py-5 sm:px-6">
              <p className={`${unbounded.className} truncate text-2xl font-extrabold tracking-[-0.04em] text-zinc-950 sm:text-4xl`}>
                {formatCurrency(deal.price, localeCode)}
              </p>
              <p className="mt-2 truncate text-[11px] font-medium text-zinc-500 sm:text-xs">
                {tContracts("PaymentMethod")}: {" "}
                <span className="font-bold text-[#0f8c5c] dark:text-brand-accent">
                  {paymentMethod}
                </span>
              </p>
            </div>
            <div className="absolute bottom-4 left-1/2 top-4 w-px -translate-x-1/2 bg-zinc-200 dark:bg-white/12" />
            <div className="min-w-0 px-4 py-5 text-center sm:px-6">
              <p className={`${unbounded.className} truncate text-2xl font-extrabold tracking-[-0.04em] text-zinc-950 sm:text-4xl`}>
                {deal.status === "completed" && deal.actualDurationMinutes !== undefined && deal.actualDurationMinutes !== null
                  ? formatDurationMinutes(deal.actualDurationMinutes, locale)
                  : deal.status === "in_progress" && deal.plannedDeadlineAt
                    ? now === null
                      ? formatDateTime(deal.plannedDeadlineAt, localeCode)
                      : timeStatus.isOverdue
                      ? t("overdue")
                      : formatTimeRemaining(deal.plannedDeadlineAt, locale, now)
                  : deal.deadlineDays
                    ? tContracts("DeadlineValue", { days: deal.deadlineDays })
                    : tContracts("NoDeadline")}
              </p>
              <p className="mt-2 truncate text-[11px] font-medium text-zinc-500 sm:text-xs">
                {deal.status === "completed"
                  ? t("actual_duration")
                  : deal.status === "in_progress" && deal.plannedDeadlineAt
                    ? now === null
                      ? tContracts("DeadlineLabel")
                      : timeStatus.isOverdue
                        ? `${t("overdue")} · ${formatDateTime(deal.plannedDeadlineAt, localeCode)}`
                        : `${t("time_remaining")} · ${formatDateTime(deal.plannedDeadlineAt, localeCode)}`
                    : tContracts("DeadlineLabel")}
              </p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 dark:border-white/12">
            <MetaCell icon={<UserIcon />} label={t("customer")}>
              {getDealUserValue(deal.customer, t("not_specified"))}
            </MetaCell>
            <MetaCell icon={<PeopleIcon />} label={t("freelancer")} dividerLeft>
              {getDealUserValue(deal.freelancer, t("not_specified"))}
            </MetaCell>
            <MetaCell icon={<CalendarIcon />} label={t("created")} dividerTop>
              {formatDateTime(deal.createdAt, localeCode)}
            </MetaCell>
            <MetaCell icon={<DocumentIcon />} label={deal.completedAt ? t("completed_at") : t("updated")} dividerLeft dividerTop>
              {formatDateTime(deal.completedAt || deal.updatedAt, localeCode)}
            </MetaCell>
          </div>
        </>
      }
      supplemental={
        isCustomer &&
        deal.isEscrow &&
        (deal.escrowVersion ?? 1) >= 2 &&
        now !== null && timeStatus.isOverdue ? (
          <a
            href="#deal-actions"
            className="flex items-center justify-between gap-3 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-800 transition hover:bg-red-500/15 dark:text-red-300"
          >
            <span>{t("refund_available")}</span>
            <span aria-hidden="true">↓</span>
          </a>
        ) : null
      }
    />
  );
}

function MetaCell({
  icon,
  label,
  children,
  dividerLeft = false,
  dividerTop = false,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
  dividerLeft?: boolean;
  dividerTop?: boolean;
}) {
  return (
    <div
      className={`flex min-w-0 items-start gap-3 px-4 py-4 ${dividerLeft ? "border-l border-zinc-200 dark:border-white/12" : ""} ${dividerTop ? "border-t border-zinc-200 dark:border-white/12" : ""}`}
    >
      <span className="mt-0.5 h-5 w-5 shrink-0 text-zinc-500 [&>svg]:h-full [&>svg]:w-full">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{label}</p>
        <div className="mt-1 truncate text-sm font-semibold text-zinc-900">{children}</div>
      </div>
    </div>
  );
}

function getDealUserValue(
  user: {
    id: number;
    name: string | null;
    telegramUsername: string | null;
  } | null | undefined,
  fallbackLabel: string,
) {
  if (!user) {
    return fallbackLabel;
  }

  const value = user.telegramUsername ? `@${user.telegramUsername}` : user.name || fallbackLabel;

  return (
    <Link
      href={routes.profileBySlug(
        getUserProfileSlug({
          id: user.id,
          telegramUsername: user.telegramUsername,
        }),
      )}
      className="transition hover:text-zinc-600"
    >
      {value}
    </Link>
  );
}
