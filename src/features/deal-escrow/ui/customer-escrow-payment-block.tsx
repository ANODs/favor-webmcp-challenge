import { Button } from "@/shared/ui";
import { formatCurrency } from "@/shared/lib/format";
import { getEscrowCurrencyDisplayName } from "@/shared/lib/ton";
import { TonConnectButton } from "@tonconnect/ui-react";
import { useTranslations } from "next-intl";
import type { DealDto } from "@/entities/deal";

type Props = {
  deal: DealDto;
  tonWallet: unknown;
  loadingText: string;
  handleLockEscrow: () => Promise<void>;
  verifyEscrowMutation: {
    mutateAsync: (payload: Record<string, never>) => Promise<unknown>;
  };
  setActionError: (err: string) => void;
};

const PLATFORM_FEE_PERCENT = 5;

const formatPercentValue = (value: number) =>
  value.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });

const formatStablecoinPrice = (value: number | string, symbol: string) =>
  `${Number(value).toLocaleString(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  })} ${symbol}`;

const getDisplayName = (referrer: NonNullable<DealDto["contractReferral"]>["referrer"]) =>
  referrer.name || (referrer.telegramUsername ? `@${referrer.telegramUsername}` : `#${referrer.id}`);

export function CustomerEscrowPaymentBlock({ deal, tonWallet, loadingText, handleLockEscrow, verifyEscrowMutation, setActionError }: Props) {
  const t = useTranslations("Escrow");
  const contractReferral = deal.contractReferral;
  const hasScoutEscrow = Boolean(contractReferral);
  const paymentCurrency = deal.escrowCurrency ?? "TON";
  const paymentCurrencyLabel = getEscrowCurrencyDisplayName(paymentCurrency);
  const isStablecoinEscrow = paymentCurrency === "USDT";
  const isUnsupportedEscrow = paymentCurrency !== "TON" && !isStablecoinEscrow;
  const amountLabel = isStablecoinEscrow
    ? formatStablecoinPrice(deal.price, paymentCurrency)
    : formatCurrency(deal.price);
  const scoutCommissionSharePercent = contractReferral
    ? Number(contractReferral.rewardPercent)
    : 0;
  const scoutDealPercent = hasScoutEscrow
    ? (PLATFORM_FEE_PERCENT * scoutCommissionSharePercent) / 100
    : 0;
  const platformDealPercent = PLATFORM_FEE_PERCENT - scoutDealPercent;
  const missingScoutWallet = Boolean(contractReferral && !contractReferral.referrer.walletAddress);

  if (!tonWallet) {
    return (
      <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl bg-amber-500/10 p-4 border border-amber-500/20 text-center">
        <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
          {t("payment_title")}
        </p>
        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          {t("connect_wallet_msg")}
        </p>
        <TonConnectButton className="mx-auto" />
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-zinc-900 text-white p-5 border border-white/10 shadow-xl backdrop-blur-md">
      <div className="flex justify-between items-center border-b border-white/10 pb-3">
        <span className="text-sm font-medium text-zinc-400">{t("amount_to_pay")}</span>
        <span className="text-lg font-bold text-white">{amountLabel}</span>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
            {t("escrow_type")}
          </span>
          <span className="text-xs font-semibold text-white">
            {isStablecoinEscrow
              ? t("stablecoin_escrow", { asset: paymentCurrency })
              : hasScoutEscrow
                ? t("scout_escrow")
                : t("standard_escrow")}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-xs text-zinc-400">
            {t("payment_asset")}
          </span>
          <span className="text-xs font-semibold text-white">
            {paymentCurrencyLabel}
          </span>
        </div>
        {contractReferral ? (
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-xs text-zinc-400">
              {contractReferral.source === "scout" ? t("scout_referrer") : t("invited_author_referrer")}
            </span>
            <span className="min-w-0 truncate text-right text-xs font-medium text-white">
              {getDisplayName(contractReferral.referrer)}
            </span>
          </div>
        ) : null}
      </div>
      <div className="grid gap-2 text-xs text-zinc-300">
        <div className="flex items-center justify-between gap-3 rounded-xl bg-white/5 px-3 py-2">
          <span>{t("contractor_payout")}</span>
          <span className="font-semibold text-white">95%</span>
        </div>
        {hasScoutEscrow ? (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-white/5 px-3 py-2">
            <span>{t("scout_payout")}</span>
            <span className="font-semibold text-white">
              {formatPercentValue(scoutDealPercent)}%
            </span>
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-3 rounded-xl bg-white/5 px-3 py-2">
          <span>{t("platform_fee")}</span>
          <span className="font-semibold text-white">
            {formatPercentValue(platformDealPercent)}%
          </span>
        </div>
      </div>
      <div className="text-xs text-zinc-400 flex flex-col gap-1">
        <p>{t("frozen_msg")}</p>
        {isStablecoinEscrow ? <p>{t("ton_gas_only")}</p> : null}
        <p>{t("unlock_msg")}</p>
        <p>{t("arbitration_msg")}</p>
      </div>
      {missingScoutWallet ? (
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-100">
          {t("scout_wallet_required")}
        </div>
      ) : null}
      {isUnsupportedEscrow ? (
        <div className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-xs text-red-100">
          {t("unsupported_asset", { asset: paymentCurrency })}
        </div>
      ) : null}
      {deal.escrowAddress && (
        <div className="mt-1 p-2 bg-white/5 rounded-lg border border-white/10 text-[10px] font-mono text-zinc-400 break-all text-center">
          {t("contract_address", { address: deal.escrowAddress })}
        </div>
      )}
      <div className="flex flex-col gap-2 mt-2">
        <Button
          onClick={handleLockEscrow}
          loading={loadingText !== ""}
          disabled={loadingText !== "" || missingScoutWallet || isUnsupportedEscrow}
          variant="primary"
          shape="rounded-2xl"
          className="bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-lg"
          fullWidth
        >
          {loadingText || (isStablecoinEscrow ? t("deposit_asset_btn", { asset: paymentCurrency }) : t("deposit_btn"))}
        </Button>

        {deal.escrowState === "awaiting_deposit" && (
          <Button
            onClick={async () => {
              setActionError("");
              try {
                await verifyEscrowMutation.mutateAsync({});
              } catch {
                // error is handled in use-escrow-actions
              }
            }}
            loading={loadingText !== ""}
            disabled={loadingText !== ""}
            variant="primary"
            shape="rounded-2xl"
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-lg"
            fullWidth
          >
            {t("check_payment_btn")}
          </Button>
        )}
      </div>
    </div>
  );
}
