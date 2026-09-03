import { getEscrowCurrencyDisplayName } from "@/shared/lib/ton";

const ESCROW_FEE_PERCENT = 5;

const roundAssetAmount = (value: number) => Number(value.toFixed(9));

export type EscrowSettlementBreakdown = {
  totalAmount: number;
  freelancerAmount: number;
  scoutAmount: number;
  platformAmount: number;
  freelancerPercent: number;
  scoutPercent: number;
  platformPercent: number;
};

export const getEscrowSettlementBreakdown = ({
  price,
  referralRewardPercent,
}: {
  price: number | string;
  referralRewardPercent?: number | string | null;
}): EscrowSettlementBreakdown | null => {
  const totalAmount = Number(price);

  if (!Number.isFinite(totalAmount) || totalAmount < 0) {
    return null;
  }

  const normalizedReferralShare = Math.min(
    100,
    Math.max(0, Number(referralRewardPercent) || 0),
  );
  const platformFeeAmount = totalAmount * ESCROW_FEE_PERCENT / 100;
  const scoutAmount = platformFeeAmount * normalizedReferralShare / 100;
  const platformAmount = platformFeeAmount - scoutAmount;
  const scoutPercent = ESCROW_FEE_PERCENT * normalizedReferralShare / 100;

  return {
    totalAmount: roundAssetAmount(totalAmount),
    freelancerAmount: roundAssetAmount(totalAmount - platformFeeAmount),
    scoutAmount: roundAssetAmount(scoutAmount),
    platformAmount: roundAssetAmount(platformAmount),
    freelancerPercent: 100 - ESCROW_FEE_PERCENT,
    scoutPercent: roundAssetAmount(scoutPercent),
    platformPercent: roundAssetAmount(ESCROW_FEE_PERCENT - scoutPercent),
  };
};

export const formatDealAssetAmount = (
  value: number | string,
  currency: string,
  locale = "ru-RU",
) => {
  const amount = Number(value);
  const displayCurrency = getEscrowCurrencyDisplayName(currency);

  if (!Number.isFinite(amount)) {
    return `${value} ${displayCurrency}`;
  }

  const minimumFractionDigits = amount !== 0 && Math.abs(amount) < 0.01 ? 3 : 2;

  return `${new Intl.NumberFormat(locale, {
    minimumFractionDigits,
    maximumFractionDigits: currency === "TON" ? 9 : 6,
  }).format(amount)} ${displayCurrency}`;
};
