"use client";

import { useMemo, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";

import {
  defaultContractFormState,
  type ContractFormState,
  type TelegramPostPreviewDto,
} from "@/entities/contract";

import type { ContractLanguage } from "../lib/content-step-validation";
import { ContractContentStep } from "./contract-content-step";
import { ContractSourceStep } from "./contract-source-step";
import { ContractTermsStep } from "./contract-terms-step";
import { ContractWizardShell } from "./contract-wizard-shell";

type Props = {
  copy: {
    title: string;
    description: string;
    personalization: string;
    tags: string;
  };
  progress: number;
};

const EXECUTOR_POST_URL = "https://t.me/alex_web/128";

const clamp = (value: number) => Math.min(1, Math.max(0, value));

export function CreateContractWizardPreview({ copy, progress }: Props) {
  const t = useTranslations("CreateContract");
  const locale = useLocale() === "en" ? "en" : "ru";
  const normalizedProgress = clamp(progress);
  const activeStep =
    normalizedProgress < 0.34 ? 0 : normalizedProgress < 0.66 ? 1 : 2;
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeLanguage: ContractLanguage = locale;
  const typedUrlLength = Math.round(
    EXECUTOR_POST_URL.length * clamp(normalizedProgress / 0.14),
  );
  const isPreviewPending =
    normalizedProgress >= 0.14 && normalizedProgress < 0.22;
  const hasPreview = normalizedProgress >= 0.22;
  const hasPersonalDetails = normalizedProgress >= 0.48;
  const isActivelyFilling =
    normalizedProgress < 0.22 ||
    (normalizedProgress >= 0.34 && normalizedProgress < 0.48) ||
    (normalizedProgress >= 0.66 && normalizedProgress < 0.88);

  const preview = useMemo<TelegramPostPreviewDto>(
    () => ({
      telegramPostUrl: EXECUTOR_POST_URL,
      telegramChannelUrl: "https://t.me/alex_web",
      description: copy.description,
      images: [],
      translation: {
        titleRu: copy.title,
        titleEn: copy.title,
        descriptionRu: copy.description,
        descriptionEn: copy.description,
      },
    }),
    [copy.description, copy.title],
  );

  const form = useMemo<ContractFormState>(() => {
    const personalization = hasPersonalDetails
      ? `\n\n${copy.personalization}`
      : "";

    return {
      ...defaultContractFormState,
      titleRu: copy.title,
      titleEn: copy.title,
      descriptionRu: `${copy.description}${personalization}`,
      descriptionEn: `${copy.description}${personalization}`,
      type: "offer",
      category: "development",
      tagsInput: copy.tags,
      basePrice: normalizedProgress >= 0.74 ? "1200" : "",
      deadlineDays: normalizedProgress >= 0.82 ? "14" : "",
      maxOpenDeals: "1",
      telegramPostUrl: EXECUTOR_POST_URL.slice(0, typedUrlLength),
      telegramChannelUrl: hasPreview ? preview.telegramChannelUrl : "",
      cachedTelegramText: hasPreview ? preview.description : "",
      mediaRefs: [],
      isScouting: false,
      scoutedTelegramUsername: "",
      isEscrow: true,
      escrowCurrency: "USDT",
    };
  }, [
    copy.description,
    copy.personalization,
    copy.tags,
    copy.title,
    hasPersonalDetails,
    hasPreview,
    normalizedProgress,
    preview,
    typedUrlLength,
  ]);

  const steps = [
    {
      label: t("WizardStepSource"),
      title: t("WizardSourceTitle"),
      description: t("WizardSourceDescription"),
    },
    {
      label: t("WizardStepContent"),
      title: t("WizardContentTitle"),
      description: t("WizardContentDescription"),
    },
    {
      label: t("WizardStepTerms"),
      title: t("WizardTermsTitle"),
      description: t("WizardTermsDescription"),
    },
  ] as const;
  const currentStep = steps[activeStep];
  const updateFormField = <T extends keyof ContractFormState>(
    field: T,
    value: ContractFormState[T],
  ) => {
    void field;
    void value;
  };

  return (
    <form
      className={`h-full overflow-hidden bg-zinc-950 text-white ${
        isActivelyFilling
          ? "[&_input]:ring-1 [&_input]:ring-brand-accent/70 [&_textarea]:ring-1 [&_textarea]:ring-brand-accent/70"
          : ""
      }`}
      data-preview-progress={normalizedProgress.toFixed(2)}
      onSubmit={(event) => event.preventDefault()}
      aria-label={t("WizardCreateContract")}
    >
      <ContractWizardShell
        activeStep={activeStep}
        stepLabels={steps.map((step) => step.label)}
        stepCounter={t("WizardStepCounter", {
          current: activeStep + 1,
          total: steps.length,
        })}
        title={currentStep.title}
        description={currentStep.description}
        scrollContainerRef={scrollContainerRef}
        primaryLabel={
          activeStep === 2 ? t("WizardCreateContract") : t("WizardNext")
        }
        autosaveLabel={t("WizardAutosave")}
        showFooter={activeStep !== 2 || normalizedProgress >= 0.88}
        compact
      >
        {activeStep === 0 ? (
          <ContractSourceStep
            form={form}
            preview={hasPreview ? preview : null}
            botUsername="FavorDealsBot"
            addTelegramPostButton={false}
            isSkipped={false}
            isPending={isPreviewPending}
            selectedImagesCount={0}
            updateFormField={updateFormField}
            onUrlChange={() => undefined}
            onFetchPreview={() => undefined}
            onSkip={() => undefined}
            toggleImage={() => undefined}
            setPrimaryImage={() => undefined}
            setAddTelegramPostButton={() => undefined}
            showPostButtonControl={false}
            hideUrlPlaceholder={normalizedProgress < 0.14}
            compact
          />
        ) : null}

        {activeStep === 1 ? (
          <ContractContentStep
            form={form}
            wasAutoTranslated
            activeLanguage={activeLanguage}
            setActiveLanguage={() => undefined}
            updateFormField={updateFormField}
            getFieldError={() => undefined}
            showClassification={false}
            compact
          />
        ) : null}

        {activeStep === 2 ? (
          <ContractTermsStep
            form={form}
            updateFormField={updateFormField}
            hideValuePlaceholders
            compact
          />
        ) : null}
      </ContractWizardShell>
    </form>
  );
}
