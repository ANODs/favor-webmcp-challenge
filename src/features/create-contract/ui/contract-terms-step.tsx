"use client";

import {
  Banknote,
  CalendarDays,
  Check,
  Circle,
  HandCoins,
  Infinity as InfinityIcon,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { useTranslations } from "next-intl";

import type { ContractFormState } from "@/entities/contract";
import { getEscrowCurrencyDisplayName } from "@/shared/lib/ton";

import {
  wizardChoiceClassName,
  wizardFieldClassName,
  wizardHelperClassName,
  wizardSegmentedOptionClassName,
} from "./wizard-styles";

type Props = {
  form: ContractFormState;
  updateFormField: <T extends keyof ContractFormState>(
    field: T,
    value: ContractFormState[T],
  ) => void;
  compact?: boolean;
  hideValuePlaceholders?: boolean;
};

export function ContractTermsStep({
  form,
  updateFormField,
  compact = false,
  hideValuePlaceholders = false,
}: Props) {
  const t = useTranslations("CreateContract");
  const hasUnlimitedDeals = form.maxOpenDeals === "";

  return (
    <div>
      <div className={`border-b border-zinc-200 dark:border-white/10 ${compact ? "pb-3.5" : "pb-5"}`}>
        <h2 className={`${compact ? "text-[13px]" : "text-base sm:text-lg"} font-semibold text-zinc-950`}>
          {t("WizardDealTypeTitle")}
        </h2>
        <p className={`${compact ? "mt-0.5 text-[10px] leading-4" : "mt-1 text-sm leading-6"} text-zinc-600`}>
          {t("WizardDealTypeDescription")}
        </p>
      </div>

      <fieldset className={compact ? "mt-3" : "mt-5"}>
        <legend className="sr-only">{t("WizardDealTypeTitle")}</legend>
        <div className={`grid ${compact ? "gap-2" : "gap-3 md:grid-cols-2"}`}>
          <button
            type="button"
            disabled={form.isScouting}
            className={wizardChoiceClassName(
              form.isEscrow && !form.isScouting,
              form.isScouting,
            )}
            aria-pressed={form.isEscrow && !form.isScouting}
            onClick={() => updateFormField("isEscrow", true)}
          >
            {form.isEscrow && !form.isScouting ? (
              <Check className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            ) : (
              <Circle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            )}
            <span>
              <span className="flex items-center gap-2 text-sm font-semibold sm:text-[15px]">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                {t("WizardEscrowTitle")}
              </span>
              <span
                className="mt-1 block text-xs leading-5 text-zinc-500"
              >
                {t("WizardEscrowDescription")}
              </span>
            </span>
          </button>

          <button
            type="button"
            className={wizardChoiceClassName(!form.isEscrow)}
            aria-pressed={!form.isEscrow}
            onClick={() => updateFormField("isEscrow", false)}
          >
            {!form.isEscrow ? (
              <Check className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            ) : (
              <Circle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            )}
            <span>
              <span className="flex items-center gap-2 text-sm font-semibold sm:text-[15px]">
                <HandCoins className="h-4 w-4" aria-hidden="true" />
                {t("WizardDirectTitle")}
              </span>
              <span
                className="mt-1 block text-xs leading-5 text-zinc-500"
              >
                {t("WizardDirectDescription")}
              </span>
            </span>
          </button>
        </div>
      </fieldset>

      {form.isScouting ? (
        <div
          className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200"
          role="status"
        >
          {t("WizardScoutDirectOnly")}
        </div>
      ) : null}

      {form.isEscrow && !form.isScouting ? (
        <fieldset className="mt-6">
          <legend className="text-sm font-semibold text-zinc-900">
            {t("WizardCurrencyLabel")}
          </legend>
          <div className="mt-2 grid grid-cols-2 gap-1 rounded-2xl bg-zinc-100 p-1 dark:bg-white/10">
            {(["TON", "USDT"] as const).map((currency) => (
              <button
                key={currency}
                type="button"
                onClick={() =>
                  updateFormField("escrowCurrency", currency)
                }
                className={`min-h-12 rounded-xl px-3 text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-brand-accent-ink dark:focus-visible:ring-brand-accent ${wizardSegmentedOptionClassName(
                  form.escrowCurrency === currency,
                )}`}
                aria-pressed={form.escrowCurrency === currency}
              >
                {getEscrowCurrencyDisplayName(currency)}
              </button>
            ))}
          </div>
          <p className={`mt-2 ${wizardHelperClassName}`}>
            {form.escrowCurrency === "USDT"
              ? t("WizardUsdtHelper")
              : t("WizardTonHelper")}
          </p>
        </fieldset>
      ) : null}

      <div className={`${compact ? "mt-4 pt-4" : "mt-7 pt-6"} border-t border-zinc-200 dark:border-white/10`}>
        <h2 className={`${compact ? "text-[13px]" : "text-base sm:text-lg"} font-semibold text-zinc-950`}>
          {t("WizardCommercialTermsTitle")}
        </h2>
        <p className={`${compact ? "mt-0.5 text-[10px] leading-4" : "mt-1 text-sm leading-6"} text-zinc-600`}>
          {t("WizardCommercialTermsDescription")}
        </p>

        <div className={`mt-4 grid gap-4 ${compact ? "" : "md:grid-cols-2"}`}>
          <label className="grid gap-2 text-sm font-semibold text-zinc-900">
            {t("PriceLabel")}
            <div className="relative">
              <Banknote
                className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
                aria-hidden="true"
              />
              <input
                name="basePrice"
                type="number"
                min="0"
                step="0.01"
                value={form.basePrice}
                onChange={(event) =>
                  updateFormField("basePrice", event.target.value)
                }
                placeholder={hideValuePlaceholders ? "" : "100"}
                className={`${wizardFieldClassName} pl-11`}
              />
            </div>
            <span className={wizardHelperClassName}>
              {t("WizardPriceHelper")}
            </span>
          </label>

          <label className="grid gap-2 text-sm font-semibold text-zinc-900">
            {t("DeadlineLabel")}
            <div className="relative">
              <CalendarDays
                className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
                aria-hidden="true"
              />
              <input
                name="deadlineDays"
                type="number"
                min="1"
                max="365"
                value={form.deadlineDays}
                onChange={(event) =>
                  updateFormField("deadlineDays", event.target.value)
                }
                placeholder={hideValuePlaceholders ? "" : "7"}
                className={`${wizardFieldClassName} pl-11`}
              />
            </div>
            <span className={wizardHelperClassName}>
              {t("WizardDeadlineHelper")}
            </span>
          </label>
        </div>

        <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-white/10">
          <div className={`flex flex-col gap-4 ${compact ? "" : "sm:flex-row sm:items-end"}`}>
            <label className="grid min-w-0 flex-1 gap-2 text-sm font-semibold text-zinc-900">
              <span className="flex items-center gap-2">
                <UsersRound className="h-4 w-4" aria-hidden="true" />
                {t("MaxOpenDealsLabel")}
              </span>
              <input
                type="number"
                min="1"
                max="20"
                value={form.type === "order" ? "1" : form.maxOpenDeals}
                onChange={(event) =>
                  updateFormField("maxOpenDeals", event.target.value)
                }
                disabled={form.type === "order" || hasUnlimitedDeals}
                className={wizardFieldClassName}
              />
            </label>

            <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border border-zinc-200 px-4 text-sm font-semibold text-zinc-900 dark:border-white/10">
              <input
                type="checkbox"
                disabled={form.type === "order"}
                checked={hasUnlimitedDeals}
                onChange={(event) =>
                  updateFormField(
                    "maxOpenDeals",
                    event.target.checked ? "" : "3",
                  )
                }
                className="h-4 w-4 rounded border-zinc-300 accent-brand-accent-ink dark:accent-brand-accent"
              />
              <InfinityIcon className="h-4 w-4" aria-hidden="true" />
              {t("WizardUnlimited")}
            </label>
          </div>
          <p className={`mt-2 ${wizardHelperClassName}`}>
            {form.type === "order"
              ? t("WizardOrderLimitHelper")
              : t("WizardLimitHelper")}
          </p>
        </div>
      </div>
    </div>
  );
}
