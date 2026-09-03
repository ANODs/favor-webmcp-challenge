"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import type { ContractDto } from "@/entities/contract";
import { ContractAiModerationInsights } from "@/entities/contract/ui";
import { ContractCard } from "@/widgets/contract-feed";

type Props = {
  contracts: ContractDto[];
  botUsername: string;
  viewerTelegramId?: string | bigint | number | null;
  approvePendingId?: number | null;
  rejectPendingId?: number | null;
  archivePendingId?: number | null;
  onApprove: (id: number) => Promise<void>;
  onReject: (id: number, comment: string) => Promise<void>;
  onArchive: (id: number, comment: string) => Promise<void>;
};

export function ModerationPanel({
  contracts,
  botUsername,
  viewerTelegramId,
  approvePendingId,
  rejectPendingId,
  archivePendingId,
  onApprove,
  onReject,
  onArchive,
}: Props) {
  const t = useTranslations("ModerationView");
  const [comments, setComments] = useState<Record<number, string>>({});

  return (
    <div className="grid gap-4">
      {contracts.map((contract) => {
        const isPending = contract.status === "pending_moderation";
        const isActive = contract.status === "active";

        return (
          <ContractCard
            key={contract.id}
            contract={contract}
            viewerRole="moderator"
            viewerTelegramId={viewerTelegramId}
            botUsername={botUsername}
            action={isPending || isActive ? (
              <div className="flex w-full min-w-0 flex-col gap-3 sm:min-w-[280px]">
                <ContractAiModerationInsights
                  riskFactor={contract.aiRiskFactor}
                  summary={contract.aiModerationSummary}
                />
                <textarea
                  value={comments[contract.id] ?? ""}
                  onChange={(event) =>
                    setComments((current) => ({
                      ...current,
                      [contract.id]: event.target.value,
                    }))
                  }
                  rows={4}
                  placeholder={
                    isPending
                      ? t("rejectPlaceholder")
                      : t("archivePlaceholder")
                  }
                  className="rounded-3xl border border-zinc-200 px-4 py-3 text-sm outline-none transition focus:border-zinc-900"
                />
                {isPending ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onApprove(contract.id)}
                      disabled={
                        approvePendingId === contract.id ||
                        rejectPendingId === contract.id
                      }
                      className="flex-1 rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
                    >
                      {approvePendingId === contract.id
                        ? t("approving")
                        : t("approve")}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onReject(contract.id, comments[contract.id] ?? "")
                      }
                      disabled={
                        approvePendingId === contract.id ||
                        rejectPendingId === contract.id
                      }
                      className="flex-1 rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {rejectPendingId === contract.id
                        ? t("rejecting")
                        : t("reject")}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      onArchive(contract.id, comments[contract.id] ?? "")
                    }
                    disabled={archivePendingId === contract.id}
                    className="w-full rounded-full border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-medium text-orange-700 transition hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {archivePendingId === contract.id
                      ? t("archiving")
                      : t("archive")}
                  </button>
                )}
              </div>
            ) : undefined}
          />
        );
      })}
    </div>
  );
}
