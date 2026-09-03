import { useState } from "react";
import { useTranslations } from "next-intl";

import type { DealDto } from "@/entities/deal";
import { CreatePortfolioCaseForm } from "@/features/create-portfolio-case";
import { SurfaceCard } from "@/shared/ui";

type Props = {
  deal: DealDto;
};

const getSnapshotString = (snapshot: DealDto["contractSnapshot"], key: string) => {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return null;
  }

  const value = snapshot[key as keyof typeof snapshot];
  return typeof value === "string" ? value : null;
};

export function DealPortfolioBlock({ deal }: Props) {
  const t = useTranslations("DealDetails");
  const [isCreatingCase, setIsCreatingCase] = useState(false);

  if (deal.status !== "completed") {
    return null;
  }

  const contractTitle = deal.contract?.title || getSnapshotString(deal.contractSnapshot, "title") || t("deal_fallback");
  const contractDescription =
    deal.contract?.description || getSnapshotString(deal.contractSnapshot, "description");
  const telegramPostUrl =
    deal.contract?.telegramPostUrl || getSnapshotString(deal.contractSnapshot, "telegramPostUrl");
  const telegramChannelUrl =
    deal.contract?.telegramChannelUrl || getSnapshotString(deal.contractSnapshot, "telegramChannelUrl");
  const defaultTitle = t("portfolio_case_title", { title: contractTitle });
  const defaultDescription = [
    contractDescription ? t("portfolio_contract_context", { description: contractDescription }) : null,
    deal.details.trim() ? t("portfolio_work_done", { details: deal.details.trim() }) : null,
    deal.resultData?.trim() ? t("portfolio_deal_result", { result: deal.resultData.trim() }) : null,
  ]
    .filter(Boolean)
    .join("\n\n");
  const defaultLinks = telegramChannelUrl
    ? [{ url: telegramChannelUrl, label: t("contract_telegram_channel") }]
    : undefined;

  return (
    <SurfaceCard className="rounded-[2rem]" paddingClassName="p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-extrabold tracking-[-0.02em] text-zinc-950">{t("portfolio")}</h3>
          <p className="mt-1 text-sm font-medium text-zinc-600">
            {t("portfolio_desc")}
          </p>
        </div>
        {!isCreatingCase && (
          <button
            type="button"
            onClick={() => setIsCreatingCase(true)}
            className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-950"
          >
            {t("create_case")}
          </button>
        )}
      </div>

      {isCreatingCase && (
        <div className="mt-4">
          <CreatePortfolioCaseForm
            initialData={{
              title: defaultTitle,
              description: defaultDescription || undefined,
              telegramPostUrl: telegramPostUrl || undefined,
              links: defaultLinks,
              contractId: deal.contract?.id,
            }}
            onSuccess={() => setIsCreatingCase(false)}
            onCancel={() => setIsCreatingCase(false)}
          />
        </div>
      )}
    </SurfaceCard>
  );
}
