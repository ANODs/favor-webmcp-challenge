"use client";

import { useTranslations } from "next-intl";

import { routes } from "@/shared/config/routes";
import type { ProfileDealSummaryDto } from "@/entities/user";
import { formatCurrency, formatDateTime } from "@/shared/lib/format";
import { ActionCard, ActionCardLink, ActionCardInset } from "@/shared/ui/action-card";

type Props = {
  deals: ProfileDealSummaryDto[];
  totalCount: number;
};

export function ProfileCompletedDealsBlock({ deals, totalCount }: Props) {
  const t = useTranslations("Profile");

  return (
    <ActionCard title={t("CompletedDealsTitle")} description={t("DealsCount", { count: totalCount })}>
      {deals.length ? (
        <div className="flex flex-col gap-3 p-1">
          {deals.map((deal) => (
            <ActionCardInset key={deal.id} className="flex flex-col gap-3 border border-zinc-200">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-zinc-950">
                    {(deal.contract ? (deal.contract.titleRu || deal.contract.titleEn) : null) ?? deal.contractSnapshot?.title ?? t("ContractDeleted")}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {t("DealInfo", { id: deal.id, date: formatDateTime(deal.updatedAt) })}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold text-zinc-950">{formatCurrency(deal.price)}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {deal.deadlineDays ? t("DeadlineDays", { days: deal.deadlineDays }) : t("NoDeadline")}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-3 text-sm">
                <ActionCardLink href={routes.dealById(deal.id)} tone="secondary">
                  {t("OpenDeal")}
                </ActionCardLink>
                {deal.contract?.slug ? (
                  <ActionCardLink href={routes.contractBySlug(deal.contract.slug)} tone="secondary">
                    {t("OpenContract")}
                  </ActionCardLink>
                ) : null}
              </div>
            </ActionCardInset>
          ))}
        </div>
      ) : (
        <ActionCardInset>{t("NoCompletedDeals")}</ActionCardInset>
      )}
    </ActionCard>
  );
}
