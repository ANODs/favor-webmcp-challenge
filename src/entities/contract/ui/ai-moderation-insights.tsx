import { useTranslations } from "next-intl";

import { StatusPill } from "@/shared/ui/status-pill";

type Props = {
  riskFactor?: number | null;
  summary?: string | null;
};

export function ContractAiModerationInsights({ riskFactor, summary }: Props) {
  const t = useTranslations("Contracts");
  const hasAiData = typeof riskFactor === "number" || Boolean(summary?.trim());

  return (
    <div className="rounded-3xl border border-zinc-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-zinc-950">
          {t("AiModerationTitle")}
        </h3>
        {typeof riskFactor === "number" ? (
          <StatusPill
            label={t("AiModerationRisk", { risk: riskFactor })}
            tone={getRiskTone(riskFactor)}
          />
        ) : (
          <StatusPill label={t("AiModerationNoScore")} tone="neutral" />
        )}
      </div>

      <p className="mt-3 text-sm leading-6 text-zinc-600">
        {hasAiData
          ? summary?.trim() || t("AiModerationMissingSummary")
          : t("AiModerationUnavailable")}
      </p>
    </div>
  );
}

function getRiskTone(riskFactor: number): "success" | "info" | "warning" | "danger" {
  if (riskFactor <= 2) {
    return "success";
  }

  if (riskFactor <= 4) {
    return "info";
  }

  if (riskFactor <= 7) {
    return "warning";
  }

  return "danger";
}
