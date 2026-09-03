import type { DealDto } from "@/entities/deal";
import { formatDealAssetAmount, getEscrowSettlementBreakdown } from "@/entities/deal";
import { SurfaceCard } from "@/shared/ui";
import { useLocale, useTranslations } from "next-intl";

type Props = {
  deal: DealDto;
};

export function DealSettlementSummary({ deal }: Props) {
  const t = useTranslations("DealDetails");
  const locale = useLocale();
  const settlement = getEscrowSettlementBreakdown({
    price: deal.price,
    referralRewardPercent: deal.contractReferral?.rewardPercent,
  });

  if (!settlement) {
    return null;
  }

  const formatAmount = (amount: number) =>
    formatDealAssetAmount(amount, deal.escrowCurrency, locale);
  const items = [
    {
      label: t("settlement_total"),
      value: formatAmount(settlement.totalAmount),
    },
    {
      label: t("settlement_freelancer", { percent: settlement.freelancerPercent }),
      value: formatAmount(settlement.freelancerAmount),
    },
    ...(settlement.scoutAmount > 0
      ? [
          {
            label: t("settlement_scout", { percent: settlement.scoutPercent }),
            value: formatAmount(settlement.scoutAmount),
          },
        ]
      : []),
    {
      label: t("settlement_platform", { percent: settlement.platformPercent }),
      value: formatAmount(settlement.platformAmount),
    },
  ];

  return (
    <SurfaceCard className="rounded-[2rem] border border-emerald-500/20 bg-emerald-500/5" paddingClassName="p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-extrabold tracking-[-0.02em] text-zinc-950">
            {t("settlement_title")}
          </h3>
          <p className="mt-1 text-xs font-medium leading-5 text-zinc-600">
            {t("settlement_desc")}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
          {t("settlement_verified")}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 overflow-hidden rounded-2xl border border-emerald-500/20 bg-zinc-50 dark:bg-zinc-900/70">
        {items.map((item, index) => (
          <div
            key={item.label}
            className={`min-w-0 p-4 ${index % 2 ? "border-l border-emerald-500/20" : ""} ${index > 1 ? "border-t border-emerald-500/20" : ""}`}
          >
            <p className="text-[10px] font-semibold uppercase leading-4 tracking-[0.12em] text-zinc-500">
              {item.label}
            </p>
            <p className="mt-2 truncate text-sm font-extrabold text-zinc-950">{item.value}</p>
          </div>
        ))}
      </div>
    </SurfaceCard>
  );
}
