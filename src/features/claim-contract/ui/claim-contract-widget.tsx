"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import {
  contractQueryKeys,
  contractsClient,
  type ContractDto,
} from "@/entities/contract";
import { ActionCard, ActionCardButton, ActionCardInset } from "@/shared/ui/action-card";

type ClaimContractWidgetProps = {
  contract: ContractDto;
};

export function ClaimContractWidget({ contract }: ClaimContractWidgetProps) {
  const router = useRouter();
  const t = useTranslations("ClaimContract");
  const queryClient = useQueryClient();
  const [verificationCode, setVerificationCode] = useState<string | null>(null);
  const [error, setError] = useState<string>("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const claimMutation = useMutation({
    mutationFn: () => contractsClient.claim(contract.slug),
    onSuccess: (data) => {
      setVerificationCode(data.verificationCode);
      setError("");
    },
    onError: () => {
      setError(t("ClaimError"));
    },
  });

  const verifyMutation = useMutation({
    mutationFn: () => contractsClient.verify(contract.slug),
    onSuccess: async () => {
      setError("");
      await queryClient.invalidateQueries({
        queryKey: contractQueryKeys.detail(contract.slug),
      });
      router.refresh();
    },
    onError: () => {
      setError(t("VerificationError"));
      setCooldown(15);
    },
  });

  const isClaimable =
    contract.scoutId != null &&
    contract.authorId === contract.scoutId &&
    contract.status === "active";

  if (!isClaimable) {
    return null;
  }

  return (
    <ActionCard
      title={t("Title")}
      description={t("Description")}
    >
      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-100 p-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {!verificationCode ? (
        <ActionCardButton
          type="button"
          onClick={() => claimMutation.mutate()}
          disabled={claimMutation.isPending}
          className="mt-auto"
        >
          {claimMutation.isPending ? t("GettingCode") : t("Claim")}
        </ActionCardButton>
      ) : (
        <div className="flex flex-col gap-4">
          <ActionCardInset>
            <h4 className="font-medium text-zinc-900">{t("Instructions")}</h4>
            <ol className="list-inside list-decimal space-y-2 mt-2 text-sm text-zinc-600">
              <li>{t("OpenOriginalPost")}</li>
              <li>{t("AddCode")}</li>
            </ol>

            <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-white border border-zinc-200 p-4">
              <code className="text-sm font-bold text-zinc-900 break-all">{verificationCode}</code>
              <button
                onClick={() => navigator.clipboard.writeText(verificationCode)}
                className="shrink-0 text-sm font-medium text-zinc-900 transition hover:text-zinc-600"
              >
                {t("Copy")}
              </button>
            </div>
            
            <p className="mt-4 text-sm text-zinc-600">
              {t("AfterSave")}
            </p>
          </ActionCardInset>

          <ActionCardButton
            type="button"
            onClick={() => verifyMutation.mutate()}
            disabled={verifyMutation.isPending || cooldown > 0}
          >
            {verifyMutation.isPending
              ? t("Checking")
              : cooldown > 0
                ? t("RetryIn", { seconds: cooldown })
                : t("Verify")}
          </ActionCardButton>
        </div>
      )}
    </ActionCard>
  );
}
