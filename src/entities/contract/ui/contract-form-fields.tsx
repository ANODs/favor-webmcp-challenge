"use client";

import { CategoryPicker } from "@/entities/category";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { CONTRACT_TITLE_MAX_LENGTH } from "@/shared/config";
import { getEscrowCurrencyDisplayName } from "@/shared/lib/ton";
import type { ContractFormState } from "../model/form";

type Props = {
  form: ContractFormState;
  updateFormField: <T extends keyof ContractFormState>(field: T, value: ContractFormState[T]) => void;
  getFieldError: (field: keyof ContractFormState) => string | undefined;
  descriptionPlaceholder: string;
};

export function ContractFormFields({ form, updateFormField, getFieldError, descriptionPlaceholder }: Props) {
  const [activeTab, setActiveTab] = useState<"ru" | "en">("ru");

  const titleRuError = getFieldError("titleRu");
  const titleEnError = getFieldError("titleEn");
  const descriptionRuError = getFieldError("descriptionRu");
  const descriptionEnError = getFieldError("descriptionEn");
  const categoryError = getFieldError("category");
  const tagsError = getFieldError("tagsInput");

  const hasRuError = Boolean(titleRuError || descriptionRuError);
  const hasEnError = Boolean(titleEnError || descriptionEnError);
  const t = useTranslations("CreateContract");

  return (
    <div className="grid gap-4 mt-6">
      <div className="flex gap-2 p-1 bg-zinc-100 rounded-2xl w-fit">
        <button
          type="button"
          onClick={() => setActiveTab("ru")}
          className={`px-4 py-2 text-sm font-medium rounded-xl transition ${
            activeTab === "ru" ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-500 hover:text-zinc-900"
          } ${hasRuError && activeTab !== "ru" ? "text-red-500" : ""}`}
        >
          {t("RuTab")} {hasRuError && "•"}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("en")}
          className={`px-4 py-2 text-sm font-medium rounded-xl transition ${
            activeTab === "en" ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-500 hover:text-zinc-900"
          } ${hasEnError && activeTab !== "en" ? "text-red-500" : ""}`}
        >
          {t("EnTab")} {hasEnError && "•"}
        </button>
      </div>

      <div className={activeTab === "ru" ? "block" : "hidden"}>
        <label className="grid gap-2 text-sm font-medium text-zinc-900">
          {t("TitleRuLabel")}
          <input
            value={form.titleRu}
            onChange={(event) => updateFormField("titleRu", event.target.value)}
            maxLength={CONTRACT_TITLE_MAX_LENGTH}
            placeholder={t("TitleRuPlaceholder")}
            className={`rounded-2xl border px-4 py-3 text-sm outline-none transition ${
              titleRuError
                ? "border-red-300 focus:border-red-500"
                : "border-zinc-200 focus:border-zinc-900"
            }`}
          />
          {titleRuError ? <span className="text-sm font-normal text-red-700">{titleRuError}</span> : null}
        </label>

        <label className="grid gap-2 text-sm font-medium text-zinc-900 mt-4">
          {t("DescriptionRuLabel")}
          <textarea
            value={form.descriptionRu}
            onChange={(event) => updateFormField("descriptionRu", event.target.value)}
            rows={8}
            placeholder={descriptionPlaceholder}
            className={`rounded-2xl border px-4 py-3 text-sm outline-none transition ${
              descriptionRuError
                ? "border-red-300 focus:border-red-500"
                : "border-zinc-200 focus:border-zinc-900"
            }`}
          />
          {descriptionRuError ? <span className="text-sm font-normal text-red-700">{descriptionRuError}</span> : null}
        </label>
      </div>

      <div className={activeTab === "en" ? "block" : "hidden"}>
        <label className="grid gap-2 text-sm font-medium text-zinc-900">
          {t("TitleEnLabel")}
          <input
            value={form.titleEn}
            onChange={(event) => updateFormField("titleEn", event.target.value)}
            maxLength={CONTRACT_TITLE_MAX_LENGTH}
            placeholder={t("TitleEnPlaceholder")}
            className={`rounded-2xl border px-4 py-3 text-sm outline-none transition ${
              titleEnError
                ? "border-red-300 focus:border-red-500"
                : "border-zinc-200 focus:border-zinc-900"
            }`}
          />
          {titleEnError ? <span className="text-sm font-normal text-red-700">{titleEnError}</span> : null}
        </label>

        <label className="grid gap-2 text-sm font-medium text-zinc-900 mt-4">
          {t("DescriptionEnLabel")}
          <textarea
            value={form.descriptionEn}
            onChange={(event) => updateFormField("descriptionEn", event.target.value)}
            rows={8}
            placeholder={descriptionPlaceholder}
            className={`rounded-2xl border px-4 py-3 text-sm outline-none transition ${
              descriptionEnError
                ? "border-red-300 focus:border-red-500"
                : "border-zinc-200 focus:border-zinc-900"
            }`}
          />
          {descriptionEnError ? <span className="text-sm font-normal text-red-700">{descriptionEnError}</span> : null}
        </label>
      </div>


      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-zinc-900">
          {t("TypeLabel")}
          <select
            value={form.type}
            onChange={(event) => updateFormField("type", event.target.value as ContractFormState["type"])}
            className="rounded-2xl border border-zinc-200 px-4 py-3 text-sm outline-none transition focus:border-zinc-900"
          >
            <option value="offer">{t("TypeOffer")}</option>
            <option value="order">{t("TypeOrder")}</option>
          </select>
        </label>

        <div className="grid gap-2 text-sm font-medium text-zinc-900">
          <span>{t("CategoryLabel")}</span>
          <CategoryPicker
            value={form.category}
            onChange={(val) => updateFormField("category", val)}
            error={categoryError}
          />
        </div>
      </div>

      <div className="grid gap-2 text-sm font-medium text-zinc-900 my-2">
        {t("WizardDealTypeTitle")}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            type="button"
            disabled={form.isScouting}
            onClick={() => updateFormField("isEscrow", true)}
            className={`flex flex-col items-start gap-1 rounded-2xl border p-4 text-left transition ${
              form.isEscrow
                ? "border-blue-600 bg-blue-50/50 ring-1 ring-blue-600 dark:border-blue-500 dark:bg-blue-950/20"
                : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
            }`}
          >
            <span className="flex items-center gap-1.5 text-sm font-semibold text-zinc-950 dark:text-white">
              🛡️ {t("WizardEscrowTitle")}
            </span>
            <span className="text-[11px] font-normal leading-normal text-zinc-500 dark:text-zinc-400">
              {t("WizardEscrowDescription")}
            </span>
          </button>

          <button
            type="button"
            onClick={() => updateFormField("isEscrow", false)}
            className={`flex flex-col items-start gap-1 rounded-2xl border p-4 text-left transition ${
              !form.isEscrow
                ? "border-blue-600 bg-blue-50/50 ring-1 ring-blue-600 dark:border-blue-500 dark:bg-blue-950/20"
                : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800"
            }`}
          >
            <span className="flex items-center gap-1.5 text-sm font-semibold text-zinc-950 dark:text-white">
              💸 {t("WizardDirectTitle")}
            </span>
            <span className="text-[11px] font-normal leading-normal text-zinc-500 dark:text-zinc-400">
              {t("WizardDirectDescription")}
            </span>
          </button>
        </div>
        {form.isScouting && (
          <span className="text-xs font-normal text-amber-600 dark:text-amber-400 mt-1">
            ⚠️ {t("WizardScoutDirectOnly")}
          </span>
        )}
      </div>

      {form.isEscrow && !form.isScouting ? (
        <div className="grid gap-2 text-sm font-medium text-zinc-900">
          {t("WizardCurrencyLabel")}
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-zinc-100 p-1 dark:bg-zinc-900">
            {(["TON", "USDT"] as const).map((currency) => (
              <button
                key={currency}
                type="button"
                onClick={() => updateFormField("escrowCurrency", currency)}
                className={`min-h-11 rounded-xl px-3 text-sm font-semibold transition ${
                  (form.escrowCurrency ?? "TON") === currency
                    ? "bg-white text-zinc-950 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-800 dark:text-white dark:ring-zinc-700"
                    : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                }`}
              >
                {getEscrowCurrencyDisplayName(currency)}
              </button>
            ))}
          </div>
          <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
            {t("WizardUsdtHelper")}
          </span>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-zinc-900">
          {t("PriceLabel")}
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
              $
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.basePrice}
              onChange={(event) => updateFormField("basePrice", event.target.value)}
              placeholder="100"
              className="w-full rounded-2xl border border-zinc-200 py-3 pl-8 pr-4 text-sm outline-none transition focus:border-zinc-900"
            />
          </div>
        </label>

        <label className="grid gap-2 text-sm font-medium text-zinc-900">
          {t("DeadlineLabel")}
          <input
            type="number"
            min="1"
            value={form.deadlineDays}
            onChange={(event) => updateFormField("deadlineDays", event.target.value)}
            placeholder="7"
            className="rounded-2xl border border-zinc-200 px-4 py-3 text-sm outline-none transition focus:border-zinc-900"
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-zinc-900">
          <div className="flex items-center justify-between">
            {t("MaxOpenDealsLabel")}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                disabled={form.type === "order"}
                checked={form.maxOpenDeals === ""}
                onChange={(e) => {
                  if (e.target.checked) {
                    updateFormField("maxOpenDeals", "");
                  } else {
                    updateFormField("maxOpenDeals", "3");
                  }
                }}
                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              />
              <span className="text-xs font-normal text-zinc-600">
                {t("WizardUnlimited")}
              </span>
            </label>
          </div>
          <input
            type="number"
            min="1"
            max="20"
            value={form.type === "order" ? "1" : form.maxOpenDeals}
            onChange={(event) => updateFormField("maxOpenDeals", event.target.value)}
            disabled={form.type === "order" || form.maxOpenDeals === ""}
            className="rounded-2xl border border-zinc-200 px-4 py-3 text-sm outline-none transition focus:border-zinc-900 disabled:bg-zinc-100 disabled:text-zinc-400"
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-zinc-900">
          {t("TagsLabel")}
          <input
            value={form.tagsInput}
            onChange={(event) => updateFormField("tagsInput", event.target.value)}
            placeholder={t("TagsPlaceholder")}
            className={`rounded-2xl border px-4 py-3 text-sm outline-none transition ${
              tagsError
                ? "border-red-300 focus:border-red-500"
                : "border-zinc-200 focus:border-zinc-900"
            }`}
          />
          {tagsError ? <span className="text-sm font-normal text-red-700">{tagsError}</span> : null}
        </label>
      </div>
    </div>
  );
}
