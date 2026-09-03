import {
  Link2,
  MessageCircleQuestion,
  Plus,
  Trash2,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import type { ContractDto } from "@/entities/contract";
import { DEAL_BRIEF_RESOURCE_LIMIT } from "@/entities/deal";
import { formatCurrency } from "@/shared/lib/format";
import { getEscrowCurrencyDisplayName } from "@/shared/lib/ton";
import {
  ActionCardInset,
  Button,
  actionCardFieldClassName,
} from "@/shared/ui";

import type { DealBriefResourceDraft } from "../model/proposal-draft";

type Props = {
  contract: Pick<
    ContractDto,
    | "basePrice"
    | "deadlineDays"
    | "escrowCurrency"
    | "isEscrow"
    | "questionsEnabled"
  >;
  details: string;
  price: string;
  deadlineDays: string;
  resources: DealBriefResourceDraft[];
  messagePlaceholder: string;
  disabled: boolean;
  isDetailsValid: boolean;
  isPriceValid: boolean;
  isDeadlineValid: boolean;
  areResourcesValid: boolean;
  onDetailsChange: (value: string) => void;
  onPriceChange: (value: string) => void;
  onDeadlineDaysChange: (value: string) => void;
  onResourcesChange: (value: DealBriefResourceDraft[]) => void;
  onOpenQuestions: () => void;
};

export function DealProposalFields({
  contract,
  details,
  price,
  deadlineDays,
  resources,
  messagePlaceholder,
  disabled,
  isDetailsValid,
  isPriceValid,
  isDeadlineValid,
  areResourcesValid,
  onDetailsChange,
  onPriceChange,
  onDeadlineDaysChange,
  onResourcesChange,
  onOpenQuestions,
}: Props) {
  const t = useTranslations("ContractDetails");
  const locale = useLocale();
  const localeCode = locale === "en" ? "en-US" : "ru-RU";
  const [touchedFields, setTouchedFields] = useState({
    details: false,
    price: false,
    deadlineDays: false,
  });
  const showDetailsError = touchedFields.details && !isDetailsValid;
  const showPriceError = touchedFields.price && !isPriceValid;
  const showDeadlineError =
    touchedFields.deadlineDays && !isDeadlineValid;

  const updateResource = (
    index: number,
    field: keyof DealBriefResourceDraft,
    value: string,
  ) => {
    onResourcesChange(
      resources.map((resource, resourceIndex) =>
        resourceIndex === index ? { ...resource, [field]: value } : resource,
      ),
    );
  };

  return (
    <div className="mt-5 grid gap-5">
      {contract.questionsEnabled ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-500/20 dark:bg-blue-500/10">
          <div className="flex items-start gap-3">
            <MessageCircleQuestion
              className="mt-0.5 h-5 w-5 shrink-0 text-blue-700 dark:text-blue-300"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="text-sm font-bold text-zinc-950 dark:text-white">
                {t("ProposalQuestionTitle")}
              </p>
              <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                {t("ProposalQuestionDescription")}
              </p>
              <Button
                type="button"
                onClick={onOpenQuestions}
                variant="ghost"
                size="sm"
                shape="rounded-xl"
                className="mt-2 px-0 text-blue-700 hover:bg-transparent hover:text-blue-900 dark:text-blue-300"
              >
                {t("ProposalOpenQuestions")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <label className="grid gap-2 text-sm font-medium text-zinc-900">
        <span>
          {t("ProposalDetailsLabel")} <span aria-hidden="true">*</span>
          <span className="sr-only"> {t("ProposalRequired")}</span>
        </span>
        <textarea
          value={details}
          onChange={(event) => onDetailsChange(event.target.value)}
          rows={6}
          minLength={5}
          maxLength={3000}
          required
          aria-invalid={showDetailsError}
          aria-describedby="deal-proposal-details-help deal-proposal-details-error"
          onBlur={() =>
            setTouchedFields((current) => ({ ...current, details: true }))
          }
          placeholder={messagePlaceholder}
          disabled={disabled}
          className={actionCardFieldClassName}
        />
        <span
          id="deal-proposal-details-help"
          className="flex justify-between gap-3 text-xs font-normal text-zinc-500"
        >
          <span>{t("ProposalDetailsHelper")}</span>
          <span aria-label={t("ProposalCharactersUsed", { count: details.length })}>
            {details.length}/3000
          </span>
        </span>
        {showDetailsError ? (
          <span
            id="deal-proposal-details-error"
            className="text-xs font-medium text-red-700"
            role="alert"
          >
            {t("ProposalDetailsInvalid")}
          </span>
        ) : null}
      </label>

      <div className="grid gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-zinc-900">
              {t("ProposalMaterialsLabel")}
            </p>
            <p className="mt-1 text-xs leading-5 text-zinc-500">
              {t("ProposalMaterialsHelper")}
            </p>
          </div>
          {resources.length < DEAL_BRIEF_RESOURCE_LIMIT ? (
            <Button
              type="button"
              onClick={() =>
                onResourcesChange([...resources, { url: "", label: "" }])
              }
              variant="secondary"
              size="sm"
              shape="rounded-xl"
              disabled={disabled}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t("ProposalAddMaterial")}
            </Button>
          ) : null}
        </div>

        {resources.map((resource, index) => (
          <div
            key={index}
            className="grid gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.65fr)_auto]"
          >
            <label className="grid gap-1.5 text-xs font-medium text-zinc-600">
              {t("ProposalMaterialUrlLabel")}
              <div className="relative">
                <Link2
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
                  aria-hidden="true"
                />
                <input
                  type="url"
                  value={resource.url}
                  onChange={(event) =>
                    updateResource(index, "url", event.target.value)
                  }
                  placeholder="https://figma.com/..."
                  disabled={disabled}
                  className={`${actionCardFieldClassName} pl-10`}
                />
              </div>
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-zinc-600">
              {t("ProposalMaterialNameLabel")}
              <input
                value={resource.label}
                onChange={(event) =>
                  updateResource(index, "label", event.target.value)
                }
                maxLength={100}
                placeholder={t("ProposalMaterialNamePlaceholder")}
                disabled={disabled}
                className={actionCardFieldClassName}
              />
            </label>
            <button
              type="button"
              onClick={() =>
                onResourcesChange(
                  resources.filter((_, resourceIndex) => resourceIndex !== index),
                )
              }
              disabled={disabled}
              aria-label={t("ProposalRemoveMaterial")}
              className="self-end rounded-xl p-3 text-zinc-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-red-500/10"
            >
              <Trash2 className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        ))}

        {!areResourcesValid ? (
          <p className="text-xs font-medium text-red-700" role="alert">
            {t("ProposalMaterialsInvalid")}
          </p>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-zinc-900">
          <span>
            {t("OfferPriceLabel")} <span aria-hidden="true">*</span>
            <span className="sr-only"> {t("ProposalRequired")}</span>
          </span>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
              $
            </span>
            <input
              type="number"
              min={contract.isEscrow ? "0.01" : "0"}
              step="0.01"
              required
              aria-invalid={showPriceError}
              aria-describedby="deal-proposal-price-help deal-proposal-price-error"
              onBlur={() =>
                setTouchedFields((current) => ({ ...current, price: true }))
              }
              value={price}
              onChange={(event) => onPriceChange(event.target.value)}
              placeholder="100"
              disabled={disabled}
              className="w-full rounded-2xl border border-zinc-200 py-3 pl-8 pr-4 text-sm outline-none transition focus:border-zinc-900 disabled:cursor-not-allowed disabled:bg-zinc-100"
            />
          </div>
          <span
            id="deal-proposal-price-help"
            className="text-xs font-normal text-zinc-500"
          >
            {contract.isEscrow
              ? t("ProposalEscrowPriceHelper")
              : t("ProposalDirectPriceHelper")}
          </span>
          {showPriceError ? (
            <span
              id="deal-proposal-price-error"
              className="text-xs font-medium text-red-700"
              role="alert"
            >
              {t("ProposalPriceInvalid")}
            </span>
          ) : null}
        </label>

        <label className="grid gap-2 text-sm font-medium text-zinc-900">
          <span>
            {t("OfferDeadlineLabel")} <span aria-hidden="true">*</span>
            <span className="sr-only"> {t("ProposalRequired")}</span>
          </span>
          <input
            type="number"
            min="1"
            max="365"
            required
            aria-invalid={showDeadlineError}
            aria-describedby="deal-proposal-deadline-help deal-proposal-deadline-error"
            onBlur={() =>
              setTouchedFields((current) => ({
                ...current,
                deadlineDays: true,
              }))
            }
            value={deadlineDays}
            onChange={(event) => onDeadlineDaysChange(event.target.value)}
            disabled={disabled}
            className={actionCardFieldClassName}
          />
          <span
            id="deal-proposal-deadline-help"
            className="text-xs font-normal text-zinc-500"
          >
            {t("ProposalDeadlineHelper")}
          </span>
          {showDeadlineError ? (
            <span
              id="deal-proposal-deadline-error"
              className="text-xs font-medium text-red-700"
              role="alert"
            >
              {t("ProposalDeadlineInvalid")}
            </span>
          ) : null}
        </label>
      </div>

      <div className="grid gap-2 text-sm font-medium text-zinc-900">
        {t("DealTypeLabel")}
        <div
          className={`rounded-2xl border p-4 ${
            contract.isEscrow
              ? "border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20"
              : "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50"
          }`}
        >
          <span className="text-sm font-semibold text-zinc-950 dark:text-white">
            {contract.isEscrow
              ? `🛡️ ${t("SecureDealTitle", {
                  currency: getEscrowCurrencyDisplayName(contract.escrowCurrency),
                })}`
              : `💸 ${t("DirectDealTitle")}`}
          </span>
          <p className="mt-1 text-xs font-normal leading-5 text-zinc-500 dark:text-zinc-400">
            {contract.isEscrow
              ? t("SecureDealDescription")
              : t("DirectDealDescription")}
          </p>
        </div>
      </div>

      <ActionCardInset>
        <p className="font-semibold text-zinc-900">
          {t("ProposalSummaryTitle")}
        </p>
        <p className="mt-2">
          {t("OfferPriceSummary", {
            price: formatCurrency(price || contract.basePrice, localeCode),
          })}
        </p>
        <p className="mt-1">
          {t("OfferDeadlineSummary", {
            deadline:
              deadlineDays || contract.deadlineDays || t("NotSpecified"),
          })}
        </p>
        <p className="mt-1">
          {t("ProposalMaterialsSummary", {
            count: resources.filter((resource) => resource.url.trim()).length,
          })}
        </p>
      </ActionCardInset>
    </div>
  );
}
