import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTonConnectUI } from "@tonconnect/ui-react";
import { beginCell, toNano } from "@ton/ton";
import { useTranslations } from "next-intl";

import { dealsClient, type DealDto } from "@/entities/deal";
import { areTonAddressesEqual } from "@/shared/lib/ton";

type UseEscrowActionsProps = {
  deal: DealDto;
  tonAddress: string;
  refetch: () => Promise<unknown>;
  transitionMutation: {
    mutateAsync: (status: DealDto["status"]) => Promise<unknown>;
  };
};

type TonConnectMessage = {
  address: string;
  amount: string;
  stateInit?: string;
  payload?: string;
};

type EscrowPrepareResponse = {
  data: {
    escrowAddress: string;
    stateInitBase64: string;
    amountTon?: number | string;
    serverTime: number;
    transactionMessages?: TonConnectMessage[];
  };
};

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

export function useEscrowActions({ deal, tonAddress, refetch, transitionMutation }: UseEscrowActionsProps) {
  const t = useTranslations("Escrow");
  const [tonConnectUI] = useTonConnectUI();
  const queryClient = useQueryClient();
  const [loadingText, setLoadingText] = useState("");
  const [actionError, setActionError] = useState("");

  const updateDealMutation = useMutation({
    mutationFn: async (payload: { escrowState?: string | null }) => {
      setActionError("");
      return dealsClient.update(deal.id, payload);
    },
    onSuccess: async () => {
      await refetch();
      await queryClient.invalidateQueries({ queryKey: ["deal", deal.id] });
    },
    onError: (error: unknown) => {
      setActionError(getErrorMessage(error, t("update_deal_error")));
    },
  });

  const getServerTime = async () => {
    try {
      const res = await fetch("/api/time");
      if (res.ok) {
        const data = await res.json() as { serverTime?: number };
        return data.serverTime ?? Math.floor(Date.now() / 1000);
      }
    } catch (error) {
      console.warn("Failed to fetch server time", error);
    }
    return Math.floor(Date.now() / 1000);
  };

  const prepareEscrowMutation = useMutation({
    mutationFn: async () => {
      setActionError("");
      const response = await fetch(`/api/deals/${deal.id}/escrow-prepare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerWalletAddress: tonAddress }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(errorData.error || t("calc_escrow_error"));
      }
      return response.json() as Promise<EscrowPrepareResponse>;
    },
    onError: (error: unknown) => {
      setActionError(getErrorMessage(error, t("prepare_escrow_error")));
    },
  });

  const verifyEscrowMutation = useMutation({
    mutationFn: async ({ txHash }: { txHash?: string }) => {
      const response = await fetch(`/api/deals/${deal.id}/escrow-verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(errorData.error || t("deposit_check_error"));
      }
      return response.json();
    },
    onSuccess: async () => {
      await refetch();
      await queryClient.invalidateQueries({ queryKey: ["deal", deal.id] });
      await queryClient.invalidateQueries({ queryKey: ["deals"] });
    },
    onError: (error: unknown) => {
      setActionError(getErrorMessage(error, t("deposit_not_found")));
    },
  });

  const handleLockEscrow = async () => {
    setActionError("");
    setLoadingText(t("calculating_payment"));
    try {
      const prepareRes = await prepareEscrowMutation.mutateAsync();
      const { escrowAddress, stateInitBase64, amountTon, serverTime, transactionMessages } = prepareRes.data;

      setLoadingText(t("waiting_signature"));
      const messages: TonConnectMessage[] = Array.isArray(transactionMessages)
        ? transactionMessages
        : [
            {
              address: escrowAddress,
              amount: toNano((Number(amountTon) + 0.08).toFixed(6)).toString(),
              stateInit: stateInitBase64,
            },
          ];
      const transaction = {
        validUntil: serverTime + 300,
        messages,
      };

      const result = await tonConnectUI.sendTransaction(transaction);
      setLoadingText(t("verifying_tx"));
      await verifyEscrowMutation.mutateAsync({ txHash: result.boc });
    } catch (error: unknown) {
      console.error(error);
      setActionError(getErrorMessage(error, t("payment_cancelled")));
    } finally {
      setLoadingText("");
    }
  };

  const handleReleaseEscrow = async () => {
    setActionError("");
    setLoadingText(t("signing_unlock"));
    try {
      if (!deal.escrowAddress) {
        throw new Error(t("address_not_prepared"));
      }

      const syncReleasedEscrow = async (attempts: number, delayMs: number) => {
        for (let attempt = 1; attempt <= attempts; attempt += 1) {
          const releaseStatus = await dealsClient.getEscrowReleaseStatus(deal.id);

          if (releaseStatus.released) {
            setLoadingText(t("syncing_deal_status"));
            await transitionMutation.mutateAsync("awaiting_review");
            await refetch();
            return true;
          }

          if (attempt < attempts) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          }
        }

        return false;
      };

      // The wallet may confirm while the UI callback fails. Inspect the
      // contract first so a retry never submits the payout twice.
      setLoadingText(t("checking_payout"));
      if (await syncReleasedEscrow(1, 0)) {
        return;
      }

      const commentPayload = beginCell()
        .storeUint(0, 32)
        .storeStringTail("complete")
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

      setLoadingText(t("signing_unlock"));
      await tonConnectUI.sendTransaction(transaction);

      setLoadingText(t("confirming_payout"));
      if (!(await syncReleasedEscrow(6, 2000))) {
        throw new Error(t("payout_confirmation_pending"));
      }
    } catch (error: unknown) {
      setActionError(getErrorMessage(error, t("action_cancelled")));
    } finally {
      setLoadingText("");
    }
  };

  const handleEscrowRefund = async (actor: "customer" | "freelancer") => {
    setActionError("");
    try {
      if (!deal.escrowAddress) {
        throw new Error(t("address_not_prepared"));
      }

      const syncRefundedEscrow = async (attempts: number, delayMs: number) => {
        for (let attempt = 1; attempt <= attempts; attempt += 1) {
          const settlementStatus = await dealsClient.getEscrowReleaseStatus(deal.id);

          if (settlementStatus.refunded) {
            setLoadingText(t("syncing_deal_status"));
            await transitionMutation.mutateAsync("cancelled");
            await refetch();
            return true;
          }

          if (attempt < attempts) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          }
        }

        return false;
      };

      setLoadingText(t("checking_refund"));
      if (await syncRefundedEscrow(1, 0)) {
        return;
      }

      if (!tonAddress) {
        throw new Error(
          t(
            actor === "customer"
              ? "connect_refund_wallet"
              : "connect_freelancer_refund_wallet",
          ),
        );
      }

      const expectedSenderAddress =
        actor === "customer"
          ? deal.escrowCustomerWalletAddress
          : deal.freelancer?.walletAddress;
      if (
        expectedSenderAddress &&
        !areTonAddressesEqual(tonAddress, expectedSenderAddress)
      ) {
        throw new Error(
          t(
            actor === "customer"
              ? "wrong_refund_wallet"
              : "wrong_freelancer_refund_wallet",
          ),
        );
      }

      const commentPayload = beginCell()
        .storeUint(0, 32)
        .storeStringTail("refund")
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

      setLoadingText(t("signing_refund"));
      await tonConnectUI.sendTransaction(transaction);

      setLoadingText(t("confirming_refund"));
      if (!(await syncRefundedEscrow(6, 2000))) {
        throw new Error(t("refund_confirmation_pending"));
      }
    } catch (error: unknown) {
      setActionError(getErrorMessage(error, t("refund_cancelled")));
    } finally {
      setLoadingText("");
    }
  };

  return {
    loadingText,
    actionError,
    handleLockEscrow,
    handleReleaseEscrow,
    handleEscrowRefund,
    verifyEscrowMutation,
    updateDealMutation,
    setActionError,
  };
}
