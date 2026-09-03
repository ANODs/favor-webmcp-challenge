"use client";

import {
  BriefcaseBusiness,
  Check,
  Circle,
  Languages,
  Search,
  Sparkles,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { CategoryPicker } from "@/entities/category";
import { CONTRACT_TITLE_MAX_LENGTH } from "@/shared/config";
import {
  parseTagsInput,
  type ContractFormState,
} from "@/entities/contract";

import {
  isContractLanguageVersionComplete,
  type ContractLanguage,
} from "../lib/content-step-validation";
import {
  wizardChoiceClassName,
  wizardErrorClassName,
  wizardFieldClassName,
  wizardFieldErrorClassName,
  wizardHelperClassName,
  wizardSegmentedOptionClassName,
} from "./wizard-styles";

type Props = {
  form: ContractFormState;
  wasAutoTranslated: boolean;
  activeLanguage: ContractLanguage;
  setActiveLanguage: (language: ContractLanguage) => void;
  updateFormField: <T extends keyof ContractFormState>(
    field: T,
    value: ContractFormState[T],
  ) => void;
  getFieldError: (field: keyof ContractFormState) => string | undefined;
  compact?: boolean;
  showClassification?: boolean;
};

export function ContractContentStep({
  form,
  wasAutoTranslated,
  activeLanguage,
  setActiveLanguage,
  updateFormField,
  getFieldError,
  compact = false,
  showClassification = true,
}: Props) {
  const t = useTranslations("CreateContract");
  const ruComplete = isContractLanguageVersionComplete(form, "ru");
  const enComplete = isContractLanguageVersionComplete(form, "en");
  const tags = parseTagsInput(form.tagsInput);

  const languageMeta = {
    ru: {
      label: t("WizardRussianTab"),
      complete: ruComplete,
      titleField: "titleRu" as const,
      descriptionField: "descriptionRu" as const,
      titleLabel: t("TitleRuLabel"),
      titlePlaceholder: t("TitleRuPlaceholder"),
      descriptionLabel: t("DescriptionRuLabel"),
    },
    en: {
      label: t("WizardEnglishTab"),
      complete: enComplete,
      titleField: "titleEn" as const,
      descriptionField: "descriptionEn" as const,
      titleLabel: t("TitleEnLabel"),
      titlePlaceholder: t("TitleEnPlaceholder"),
      descriptionLabel: t("DescriptionEnLabel"),
    },
  };

  const activeMeta = languageMeta[activeLanguage];
  const titleError = getFieldError(activeMeta.titleField);
  const descriptionError = getFieldError(activeMeta.descriptionField);
  const categoryError = getFieldError("category");
  const tagsError = getFieldError("tagsInput");

  return (
    <div>
      <div className={`${compact ? "gap-2.5 pb-3.5" : "gap-4 pb-5 sm:flex-row sm:items-center sm:justify-between"} flex flex-col border-b border-zinc-200 dark:border-white/10`}>
        <div>
          <h2 className={`${compact ? "text-[13px]" : "text-base sm:text-lg"} font-semibold text-zinc-950`}>
            {t("WizardLanguageRequirementTitle")}
          </h2>
          <p className={`${compact ? "mt-0.5 text-[10px] leading-4" : "mt-1 text-sm leading-6"} text-zinc-600`}>
            {t("WizardLanguageRequirementDescription")}
          </p>
        </div>
        <div
          className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white font-semibold text-zinc-500 dark:border-white/10 ${compact ? "px-3 py-2 text-[9px]" : "px-4 py-3 text-xs"}`}
          role="status"
        >
          <Sparkles
            className="h-4 w-4 text-brand-accent-ink dark:text-brand-accent"
            aria-hidden="true"
          />
          {t("WizardAutoTranslate")}
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${
              wasAutoTranslated
                ? "bg-brand-accent/15 text-brand-accent-ink dark:text-brand-accent"
                : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
            }`}
          >
            {wasAutoTranslated
              ? t("WizardAutoTranslateApplied")
              : t("WizardPremiumFeature")}
          </span>
        </div>
      </div>

      <div className={`${compact ? "mt-3" : "mt-5"} flex rounded-2xl bg-zinc-100 p-1 dark:bg-white/10`}>
        {(["ru", "en"] as const).map((language) => {
          const meta = languageMeta[language];
          const hasError = Boolean(
            getFieldError(meta.titleField) ||
              getFieldError(meta.descriptionField),
          );

          return (
            <button
              key={language}
              type="button"
              onClick={() => setActiveLanguage(language)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-brand-accent-ink dark:focus-visible:ring-brand-accent ${compact ? "min-h-9 text-[11px]" : "min-h-11 text-sm"} ${wizardSegmentedOptionClassName(
                activeLanguage === language,
              )}`}
              aria-pressed={activeLanguage === language}
            >
              <Languages className="h-4 w-4" aria-hidden="true" />
              {meta.label}
              {meta.complete ? (
                <Check
                  className="h-4 w-4 text-brand-accent-ink dark:text-brand-accent"
                  aria-label={t("WizardLanguageComplete")}
                />
              ) : hasError ? (
                <span
                  className="h-2 w-2 rounded-full bg-red-500"
                  aria-label={t("WizardLanguageHasErrors")}
                />
              ) : null}
            </button>
          );
        })}
      </div>

      <div className={`${compact ? "mt-3 gap-2.5" : "mt-5 gap-4"} grid`}>
        <label className="grid gap-2 text-sm font-semibold text-zinc-900">
          {activeMeta.titleLabel}
          <input
            name={activeMeta.titleField}
            value={form[activeMeta.titleField]}
            onChange={(event) =>
              updateFormField(activeMeta.titleField, event.target.value)
            }
            maxLength={CONTRACT_TITLE_MAX_LENGTH}
            placeholder={activeMeta.titlePlaceholder}
            aria-invalid={Boolean(titleError)}
            aria-describedby={
              titleError ? `${activeMeta.titleField}-error` : undefined
            }
            className={`${wizardFieldClassName} ${
              titleError ? wizardFieldErrorClassName : ""
            }`}
          />
          {titleError ? (
            <span
              id={`${activeMeta.titleField}-error`}
              className={wizardErrorClassName}
              role="alert"
            >
              {titleError}
            </span>
          ) : null}
        </label>

        <label className="grid gap-2 text-sm font-semibold text-zinc-900">
          {activeMeta.descriptionLabel}
          <textarea
            name={activeMeta.descriptionField}
            value={form[activeMeta.descriptionField]}
            onChange={(event) =>
              updateFormField(
                activeMeta.descriptionField,
                event.target.value,
              )
            }
            rows={compact ? 5 : 7}
            placeholder={t("DescriptionPlaceholder")}
            aria-invalid={Boolean(descriptionError)}
            aria-describedby={
              descriptionError
                ? `${activeMeta.descriptionField}-error`
                : undefined
            }
            className={`${wizardFieldClassName} ${compact ? "min-h-32 text-[13px] leading-5" : "min-h-44 leading-6"} resize-y ${
              descriptionError ? wizardFieldErrorClassName : ""
            }`}
          />
          {descriptionError ? (
            <span
              id={`${activeMeta.descriptionField}-error`}
              className={wizardErrorClassName}
              role="alert"
            >
              {descriptionError}
            </span>
          ) : null}
        </label>
      </div>

      {showClassification ? (
      <div className="mt-7 border-t border-zinc-200 pt-6 dark:border-white/10">
        <h2 className="text-base font-semibold text-zinc-950 sm:text-lg">
          {t("WizardClassificationTitle")}
        </h2>
        <p className="mt-1 text-sm leading-6 text-zinc-600">
          {t("WizardClassificationDescription")}
        </p>

        <fieldset className="mt-4">
          <legend className="sr-only">{t("TypeLabel")}</legend>
          <div className={`grid ${compact ? "gap-2" : "gap-3 md:grid-cols-2"}`}>
            <button
              type="button"
              className={wizardChoiceClassName(form.type === "offer")}
              aria-pressed={form.type === "offer"}
              onClick={() => updateFormField("type", "offer")}
            >
              {form.type === "offer" ? (
                <Check className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              ) : (
                <Circle
                  className="mt-0.5 h-5 w-5 shrink-0"
                  aria-hidden="true"
                />
              )}
              <span>
                <span className="flex items-center gap-2 text-sm font-semibold sm:text-[15px]">
                  <BriefcaseBusiness
                    className="h-4 w-4"
                    aria-hidden="true"
                  />
                  {t("TypeOffer")}
                </span>
                <span
                  className="mt-1 block text-xs leading-5 text-zinc-500"
                >
                  {t("WizardTypeOfferDescription")}
                </span>
              </span>
            </button>

            <button
              type="button"
              className={wizardChoiceClassName(form.type === "order")}
              aria-pressed={form.type === "order"}
              onClick={() => updateFormField("type", "order")}
            >
              {form.type === "order" ? (
                <Check className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              ) : (
                <Circle
                  className="mt-0.5 h-5 w-5 shrink-0"
                  aria-hidden="true"
                />
              )}
              <span>
                <span className="flex items-center gap-2 text-sm font-semibold sm:text-[15px]">
                  <Search className="h-4 w-4" aria-hidden="true" />
                  {t("TypeOrder")}
                </span>
                <span
                  className="mt-1 block text-xs leading-5 text-zinc-500"
                >
                  {t("WizardTypeOrderDescription")}
                </span>
              </span>
            </button>
          </div>
        </fieldset>

        <div className={`mt-4 grid gap-4 ${compact ? "" : "md:grid-cols-2"}`}>
          <div className="grid gap-2 text-sm font-semibold text-zinc-900">
            <span>{t("CategoryLabel")}</span>
            <CategoryPicker
              value={form.category}
              onChange={(val) => updateFormField("category", val)}
              error={categoryError}
              tone="accent"
            />
          </div>

          <label className="grid gap-2 text-sm font-semibold text-zinc-900">
            {t("TagsLabel")}
            <input
              name="tagsInput"
              value={form.tagsInput}
              onChange={(event) =>
                updateFormField("tagsInput", event.target.value)
              }
              placeholder={t("TagsPlaceholder")}
              aria-invalid={Boolean(tagsError)}
              className={`${wizardFieldClassName} ${
                tagsError ? wizardFieldErrorClassName : ""
              }`}
            />
            {tagsError ? (
              <span className={wizardErrorClassName} role="alert">
                {tagsError}
              </span>
            ) : (
              <span className={wizardHelperClassName}>
                {tags.length > 0
                  ? tags.map((tag) => `#${tag}`).join(" · ")
                  : t("WizardTagsHelper")}
              </span>
            )}
          </label>
        </div>
      </div>
      ) : null}
    </div>
  );
}
