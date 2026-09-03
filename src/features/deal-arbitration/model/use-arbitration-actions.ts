import { useState } from "react";
import { useTonConnectUI } from "@tonconnect/ui-react";
import { beginCell, toNano } from "@ton/ton";
import { useTranslations } from "next-intl";

import type { DealDto } from "@/entities/deal";

type Props = {
  deal: DealDto;
  refetch: () => Promise<unknown>;
  transitionMutation: {
    mutateAsync: (status: DealDto["status"]) => Promise<unknown>;
  };
};

const getErrorMessage = (_error: unknown, fallback: string) => fallback;

export function useArbitrationActions({ deal, refetch, transitionMutation }: Props) {
  const t = useTranslations("Arbitration");
  const tEscrow = useTranslations("Escrow");
  const [tonConnectUI] = useTonConnectUI();
  const [loadingText, setLoadingText] = useState("");
  const [actionError, setActionError] = useState("");

  const getServerTime = async () => {
    try {
      const res = await fetch("/api/time");
      if (res.ok) {
        const data = (await res.json()) as { serverTime?: number };
        return data.serverTime ?? Math.floor(Date.now() / 1000);
      }
    } catch (e) {
      console.warn("Failed to fetch server time", e);
    }
    return Math.floor(Date.now() / 1000);
  };

  const handleRaiseDispute = async () => {
    setActionError("");
    setLoadingText(t("fixing_dispute"));
    try {
      if (!deal.escrowAddress) {
        throw new Error(tEscrow("address_not_prepared"));
      }

      const commentPayload = beginCell()
        .storeUint(0, 32)
        .storeStringTail("dispute")
        .endCell()
        .toBoc()
        .toString("base64");

      const serverTime = await getServerTime();
      const transaction = {
        validUntil: serverTime + 300,
        messages: [
          {
            address: deal.escrowAddress,
            amount: toNano("0.05").toString(),
            payload: commentPayload,
          },
        ],
      };

      await tonConnectUI.sendTransaction(transaction);

      setLoadingText(t("creating_ticket"));
      await transitionMutation.mutateAsync("cancellation_requested");
      
      await fetch(`/api/deals/${deal.id}`, {
        method: "PATCH",
      });

      await refetch();
    } catch (error: unknown) {
      setActionError(getErrorMessage(error, t("dispute_not_opened")));
    } finally {
      setLoadingText("");
    }
  };

  const handleArbitrationResolve = async (outcome: "freelancer" | "customer") => {
    setActionError("");
    setLoadingText(t("verdict_onchain"));
    try {
      if (!deal.escrowAddress) {
        throw new Error(tEscrow("address_not_prepared"));
      }

      // Once a dispute is opened, the platform fee applies regardless of the outcome.
      // Smart contract expects 'complete' or 'refund'. Both methods should deduct fee if configured so in the smart contract.
      const commentString = outcome === "freelancer" ? "complete" : "refund";
      const commentPayload = beginCell()
        .storeUint(0, 32)
        .storeStringTail(commentString)
        .endCell()
        .toBoc()
        .toString("base64");

      const serverTime = await getServerTime();
      const transaction = {
        validUntil: serverTime + 300,
        messages: [
          {
            address: deal.escrowAddress,
            amount: toNano("0.05").toString(),
            payload: commentPayload,
          },
        ],
      };

      await tonConnectUI.sendTransaction(transaction);

      setLoadingText(t("updating_status"));
      const targetStatus = outcome === "freelancer"
        ? deal.isEscrow
          ? "awaiting_review"
          : "paid_by_customer"
        : "cancelled";
      await transitionMutation.mutateAsync(targetStatus);
      await refetch();
    } catch (error: unknown) {
      setActionError(getErrorMessage(error, t("resolution_error")));
    } finally {
      setLoadingText("");
    }
  };

  return {
    loadingText,
    actionError,
    handleRaiseDispute,
    handleArbitrationResolve,
  };
}
