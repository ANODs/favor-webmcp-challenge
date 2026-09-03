import { Unbounded } from "next/font/google";
import { useTranslations } from "next-intl";

import { formatCurrency } from "@/shared/lib/format";
import { getEscrowCurrencyDisplayName } from "@/shared/lib/ton";

import type { ContractDto } from "../api/dto";
import { getContractTermsVisibility } from "../model/presentation";

const unbounded = Unbounded({ subsets: ["latin", "cyrillic"] });

type Props = {
  contract: Pick<
    ContractDto,
    "basePrice" | "deadlineDays" | "isEscrow" | "escrowCurrency"
  >;
  className?: string;
  localeCode: string;
  size?: "card" | "details";
};

export function ContractTerms({
  contract,
  className = "",
  localeCode,
  size = "card",
}: Props) {
  const t = useTranslations("Contracts");
  const { hasPrice, hasDeadline, hasTerms } =
    getContractTermsVisibility(contract);

  if (!hasTerms) {
    return null;
  }

  const showDivider = hasPrice && hasDeadline;
  const paymentMethod = contract.isEscrow
    ? getEscrowCurrencyDisplayName(contract.escrowCurrency)
    : t("DirectPaymentMethod");
  const paddingClass =
    size === "details" ? "px-4 py-5 sm:px-6" : "px-4 py-4 sm:px-5";
  const valueClass =
    size === "details"
      ? "text-2xl sm:text-4xl"
      : "text-2xl sm:text-3xl";
  const labelSpacingClass = size === "details" ? "mt-2" : "mt-1.5";

  return (
    <div
      className={`relative grid ${
        showDivider ? "grid-cols-2" : "grid-cols-1"
      } overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 dark:border-white/12 ${className}`}
    >
      {hasPrice ? (
        <div className={`min-w-0 ${paddingClass}`}>
          <p
            className={`${unbounded.className} ${valueClass} truncate font-extrabold tracking-[-0.04em] text-zinc-950`}
          >
            {formatCurrency(contract.basePrice, localeCode)}
          </p>
          <p
            className={`${labelSpacingClass} truncate text-[11px] font-medium text-zinc-500 sm:text-xs`}
          >
            {t("PaymentMethod")}:{" "}
            <span className="font-bold text-[#0f8c5c] dark:text-brand-accent">
              {paymentMethod}
            </span>
          </p>
        </div>
      ) : null}

      {showDivider ? (
        <div className="absolute bottom-4 left-1/2 top-4 w-px -translate-x-1/2 bg-zinc-200 dark:bg-white/12" />
      ) : null}

      {hasDeadline ? (
        <div className={`min-w-0 text-center ${paddingClass}`}>
          <p
            className={`${unbounded.className} ${valueClass} truncate font-extrabold tracking-[-0.04em] text-zinc-950`}
          >
            {t("DeadlineValue", { days: contract.deadlineDays ?? 0 })}
          </p>
          <p
            className={`${labelSpacingClass} truncate text-[11px] font-medium text-zinc-500 sm:text-xs`}
          >
            {t("DeadlineLabel")}
          </p>
        </div>
      ) : null}
    </div>
  );
}
