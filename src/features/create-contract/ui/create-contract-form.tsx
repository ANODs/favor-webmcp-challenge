"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { ConfirmationDialog, SurfaceCard, useDialogBackButton } from "@/shared/ui";
import {
  isTelegramBotChatRequiredError,
} from "@/entities/user";
import { TelegramBotAccessNotice } from "@/entities/user/ui";
import { useRouter } from "@/i18n/routing";
import { routes } from "@/shared/config/routes";
import { getTelegramWebApp } from "@/shared/lib/telegram";

import { contractPublicationDraftsClient } from "../api/publication-drafts-client";
import {
  isContractLanguageVersionComplete,
  type ContractLanguage,
} from "../lib/content-step-validation";
import { useCreateContractForm } from "../lib/use-create-contract-form";
import { ContractContentStep } from "./contract-content-step";
import { ContractSourceStep } from "./contract-source-step";
import { ContractTermsStep } from "./contract-terms-step";
import {
  CONTRACT_WIZARD_STEP_COUNT,
  ContractWizardShell,
} from "./contract-wizard-shell";

type WizardStep = 0 | 1 | 2;
type RuntimeContext = "detecting" | "browser" | "telegram";

export function CreateContractForm({
  publicationDraftToken,
  botUsername,
}: {
  publicationDraftToken?: string;
  botUsername: string;
}) {
  const t = useTranslations("CreateContract");
  const locale = useLocale();
  const router = useRouter();
  const [activeStep, setActiveStep] = useState<WizardStep>(0);
  const [activeLanguage, setActiveLanguage] =
    useState<ContractLanguage>("ru");
  const [isSourceSkipped, setIsSourceSkipped] = useState(false);
  const [sourceDecisionError, setSourceDecisionError] = useState("");
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [isRecoveryAccessPending, setIsRecoveryAccessPending] =
    useState(false);
  const [runtimeContext, setRuntimeContext] =
    useState<RuntimeContext>("detecting");
  const [isPreparingHandoff, setIsPreparingHandoff] = useState(false);
  const [handoffError, setHandoffError] = useState("");
  const [isClaimingDraft, setIsClaimingDraft] = useState(false);
  const [claimError, setClaimError] = useState("");
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const hasRestoredStepRef = useRef(false);

  const {
    form,
    preview,
    addTelegramPostButton,
    hasHydrated,
    draftPersistenceError,
    titleValidation,
    submitError,
    submitErrorCode,
    isSubmitPending,
    moderationResult,
    previewMutation,
    selectedImagesCount,
    getFieldError,
    validateContentStep,
    updateFormField,
    handleFetchPreview,
    clearSubmitError,
    clearTelegramSource,
    replaceDraft,
    setAddTelegramPostButton,
    submitContract,
    toggleImage,
    setPrimaryImage,
    lastClaimedToken,
    setLastClaimedToken,
  } = useCreateContractForm({ publicationDraftToken });

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setRuntimeContext(
        getTelegramWebApp()?.initData?.trim() ? "telegram" : "browser",
      );
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (
      !publicationDraftToken ||
      !hasHydrated ||
      runtimeContext !== "telegram"
    ) {
      return;
    }

    if (lastClaimedToken === publicationDraftToken) {
      if (!hasRestoredStepRef.current) {
        hasRestoredStepRef.current = true;
        const timeoutId = window.setTimeout(() => setActiveStep(2), 0);
        return () => window.clearTimeout(timeoutId);
      }
      return;
    }

    let isCurrent = true;
    const timeoutId = window.setTimeout(() => {
      setIsClaimingDraft(true);
      setClaimError("");

      void contractPublicationDraftsClient
        .claim(publicationDraftToken)
        .then((draft) => {
          if (!isCurrent) return;

          if (draft.status === "published") {
            router.replace(routes.contractBySlug(draft.contractSlug));
            return;
          }

          replaceDraft(
            draft.data.form,
            draft.data.preview,
            draft.data.wizard.addTelegramPostButton,
          );
          setLastClaimedToken(publicationDraftToken);
          setActiveLanguage(draft.data.wizard.activeLanguage);
          setIsSourceSkipped(draft.data.wizard.isSourceSkipped);
          hasRestoredStepRef.current = true;
          setActiveStep(2);
        })
        .catch(() => {
          if (!isCurrent) return;
          setClaimError(t("TelegramDraftRestoreFailed"));
        })
        .finally(() => {
          if (isCurrent) setIsClaimingDraft(false);
        });
    }, 0);

    return () => {
      isCurrent = false;
      window.clearTimeout(timeoutId);
    };
  }, [
    hasHydrated,
    publicationDraftToken,
    lastClaimedToken,
    setLastClaimedToken,
    replaceDraft,
    router,
    runtimeContext,
    t,
  ]);

  useDialogBackButton(activeStep > 0, () => {
    setActiveStep((prev) => (prev > 0 ? ((prev - 1) as WizardStep) : 0));
  });

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

  useEffect(() => {
    scrollContainerRef.current?.scrollTo({ top: 0 });
  }, [activeStep]);

  const goToStep = (step: WizardStep) => {
    setActiveStep(step);
  };

  const getContentValidationMessages = () => ({
    atLeastOneVersion: t("WizardValidationAtLeastOneVersion"),
    titleRequired: t("WizardValidationTitleRequired"),
    titleTooShort: t("WizardValidationTitleTooShort"),
    titleTooLong: t("WizardValidationTitleTooLong"),
    descriptionRequired: t("WizardValidationDescriptionRequired"),
    descriptionTooShort: t("WizardValidationDescriptionTooShort"),
  });

  const validateContent = () => {
    const result = validateContentStep(getContentValidationMessages());

    if (!result.isValid) {
      setActiveLanguage(result.preferredLanguage);
    }

    return result.isValid && !moderationResult.isBlocked;
  };

  const handlePrimaryAction = () => {
    if (activeStep === 0) {
      if (!preview && !isSourceSkipped) {
        setSourceDecisionError(t("WizardSourceDecisionError"));
        return;
      }

      setSourceDecisionError("");
      if (
        !`${form.titleRu}${form.descriptionRu}`.trim() &&
        `${form.titleEn}${form.descriptionEn}`.trim()
      ) {
        setActiveLanguage("en");
      }
      goToStep(1);
      return;
    }

    if (activeStep === 1) {
      if (!validateContent()) {
        return;
      }

      goToStep(2);
      return;
    }

    if (!validateContent()) {
      goToStep(1);
      return;
    }

    if (runtimeContext === "browser") {
      setIsPreparingHandoff(true);
      setHandoffError("");

      contractPublicationDraftsClient
        .prepare(publicationDraftData)
        .then((prepared) => {
          window.location.assign(prepared.telegramUrl);
        })
        .catch(() => {
          setHandoffError(t("TelegramDraftPrepareFailed"));
          setIsPreparingHandoff(false);
        });

      return;
    }

    setIsConfirmationOpen(true);
  };

  const handleConfirmedSubmit = async () => {
    const result = await submitContract();

    if (result.ok) {
      setIsConfirmationOpen(false);
      return;
    }

    if (result.reason === "validation" || result.reason === "moderation") {
      setIsConfirmationOpen(false);
      goToStep(1);
    }
  };

  const handleSkipSource = () => {
    clearTelegramSource();
    clearSubmitError();
    setSourceDecisionError("");
    setIsSourceSkipped(true);
  };

  const handlePostUrlChange = (value: string) => {
    if (preview && value.trim() !== preview.telegramPostUrl) {
      clearTelegramSource();
    }

    clearSubmitError();
    setSourceDecisionError("");
    setIsSourceSkipped(false);
    updateFormField("telegramPostUrl", value);
  };

  const isStep0Valid = Boolean(preview) || isSourceSkipped;

  const isRuStarted = Boolean((form.titleRu || "").trim() || (form.descriptionRu || "").trim());
  const isRuComplete = isContractLanguageVersionComplete(form, "ru");
  const isRuValid = !isRuStarted || isRuComplete;

  const isEnStarted = Boolean((form.titleEn || "").trim() || (form.descriptionEn || "").trim());
  const isEnComplete = isContractLanguageVersionComplete(form, "en");
  const isEnValid = !isEnStarted || isEnComplete;

  const isStep1Valid =
    (isRuComplete || isEnComplete) &&
    isRuValid &&
    isEnValid &&
    !moderationResult.isBlocked &&
    !titleValidation &&
    !getFieldError("titleRu") &&
    !getFieldError("titleEn") &&
    !getFieldError("descriptionRu") &&
    !getFieldError("descriptionEn") &&
    !getFieldError("category") &&
    !getFieldError("tagsInput");

  const isPriceValid =
    form.basePrice === "" ||
    (!isNaN(Number(form.basePrice)) && Number(form.basePrice) >= 0);

  const isDeadlineValid =
    form.deadlineDays === "" ||
    (!isNaN(Number(form.deadlineDays)) &&
      Number(form.deadlineDays) >= 1 &&
      Number(form.deadlineDays) <= 365);

  const isMaxDealsValid =
    form.maxOpenDeals === "" ||
    (!isNaN(Number(form.maxOpenDeals)) &&
      Number(form.maxOpenDeals) >= 1 &&
      Number(form.maxOpenDeals) <= 20);

  const isStep2Valid =
    isStep1Valid && isPriceValid && isDeadlineValid && isMaxDealsValid;

  const publicationDraftData = {
    version: 1 as const,
    form,
    preview,
    wizard: {
      activeLanguage,
      isSourceSkipped,
      addTelegramPostButton,
    },
    locale: locale === "en" ? ("en" as const) : ("ru" as const),
  };

  const isCurrentStepValid =
    activeStep === 0
      ? isStep0Valid
      : activeStep === 1
      ? isStep1Valid
      : isStep2Valid;

  if (!hasHydrated || runtimeContext === "detecting" || isClaimingDraft) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <SurfaceCard
          className="w-full max-w-lg rounded-[2rem]"
          paddingClassName="p-6"
        >
          <p className="text-sm font-medium text-zinc-600">
            {isClaimingDraft
              ? t("RestoringTelegramDraft")
              : t("RestoringDraft")}
          </p>
        </SurfaceCard>
      </div>
    );
  }

  if (publicationDraftToken && runtimeContext === "browser") {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <SurfaceCard className="w-full max-w-lg rounded-[2rem]" paddingClassName="p-6">
          <h1 className="text-lg font-semibold text-zinc-950">
            {t("TelegramDraftTelegramOnlyTitle")}
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            {t("TelegramDraftTelegramOnlyDescription")}
          </p>
        </SurfaceCard>
      </div>
    );
  }

  if (claimError) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <SurfaceCard className="w-full max-w-lg rounded-[2rem]" paddingClassName="p-6">
          <h1 className="text-lg font-semibold text-zinc-950">
            {t("TelegramDraftRestoreFailedTitle")}
          </h1>
          <p className="mt-2 text-sm leading-6 text-red-700" role="alert">
            {claimError}
          </p>
        </SurfaceCard>
      </div>
    );
  }

  const currentStep = steps[activeStep];
  const isPrimaryPending =
    previewMutation.isPending || isSubmitPending || isRecoveryAccessPending;
  const isFinalBrowserStep =
    activeStep === CONTRACT_WIZARD_STEP_COUNT - 1 &&
    runtimeContext === "browser";
  const primaryLabel = activeStep !== CONTRACT_WIZARD_STEP_COUNT - 1
    ? t("WizardNext")
    : isFinalBrowserStep
      ? isPreparingHandoff
        ? t("PreparingTelegramDraft")
        : handoffError
          ? t("RetryTelegramDraft")
          : t("FinishInTelegram")
      : t("WizardCreateContract");
  const isHandoffUnavailable = false;

  return (
    <>
      <form
        className="h-full"
        onSubmit={(event) => {
          event.preventDefault();
          handlePrimaryAction();
        }}
        noValidate
      >
        <ContractWizardShell
          activeStep={activeStep}
          stepLabels={steps.map((step) => step.label)}
          stepCounter={t("WizardStepCounter", {
            current: activeStep + 1,
            total: CONTRACT_WIZARD_STEP_COUNT,
          })}
          title={currentStep.title}
          description={currentStep.description}
          scrollContainerRef={scrollContainerRef}
          primaryLabel={primaryLabel}
          autosaveLabel={
            draftPersistenceError
              ? t("WizardAutosaveUnavailable")
              : t("WizardAutosave")
          }
          showFooter={isCurrentStepValid}
          primaryDisabled={isPrimaryPending || isHandoffUnavailable}
          primaryLoading={
            activeStep === CONTRACT_WIZARD_STEP_COUNT - 1 &&
            (isFinalBrowserStep
              ? isPreparingHandoff
              : isSubmitPending)
          }
        >
          {sourceDecisionError ? (
            <div
              className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200"
              role="alert"
            >
              {sourceDecisionError}
            </div>
          ) : null}

          {submitError ? (
            <div
              className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-900 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200"
              role="alert"
            >
              {submitError}
            </div>
          ) : null}

          {handoffError && isFinalBrowserStep ? (
            <div
              className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-900 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200"
              role="alert"
            >
              {handoffError}
            </div>
          ) : null}

          {activeStep === 1 && titleValidation ? (
            <div
              className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200"
              role="status"
            >
              {titleValidation}
            </div>
          ) : null}

          {activeStep === 1 && moderationResult.isBlocked ? (
            <div
              className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-900 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200"
              role="alert"
            >
              {moderationResult.summary}
            </div>
          ) : null}

          {activeStep === 0 ? (
            <ContractSourceStep
              form={form}
              preview={preview}
              botUsername={botUsername}
              addTelegramPostButton={addTelegramPostButton}
              isSkipped={isSourceSkipped}
              isPending={previewMutation.isPending}
              selectedImagesCount={selectedImagesCount}
              updateFormField={updateFormField}
              onUrlChange={handlePostUrlChange}
              onFetchPreview={() => {
                setIsSourceSkipped(false);
                setSourceDecisionError("");
                void handleFetchPreview();
              }}
              onSkip={handleSkipSource}
              toggleImage={toggleImage}
              setPrimaryImage={setPrimaryImage}
              setAddTelegramPostButton={setAddTelegramPostButton}
            />
          ) : null}

          {activeStep === 1 ? (
            <ContractContentStep
              form={form}
              wasAutoTranslated={Boolean(preview?.translation)}
              activeLanguage={activeLanguage}
              setActiveLanguage={setActiveLanguage}
              updateFormField={updateFormField}
              getFieldError={getFieldError}
            />
          ) : null}

          {activeStep === 2 ? (
            <ContractTermsStep
              form={form}
              updateFormField={updateFormField}
            />
          ) : null}
        </ContractWizardShell>
      </form>

      <ConfirmationDialog
        isOpen={isConfirmationOpen}
        onClose={() => setIsConfirmationOpen(false)}
        onConfirm={handleConfirmedSubmit}
        title={t("WizardConfirmationTitle")}
        description={
          <div className="space-y-4">
            <p>{t("WizardConfirmationDescription")}</p>
            <ol className="space-y-3">
              <li className="flex gap-3">
                <span className="font-semibold text-zinc-950">1.</span>
                <span>{t("WizardConfirmationModeration")}</span>
              </li>
              <li className="flex gap-3">
                <span className="font-semibold text-zinc-950">2.</span>
                <span>{t("WizardConfirmationPublication")}</span>
              </li>
              <li className="flex gap-3">
                <span className="font-semibold text-zinc-950">3.</span>
                <span>{t("WizardConfirmationChanges")}</span>
              </li>
            </ol>
          </div>
        }
        confirmLabel={t("WizardConfirmSubmit")}
        confirmVariant="accent"
        pendingLabel={t("CreatingContract")}
        cancelLabel={t("WizardReturnToForm")}
        isPending={isSubmitPending || isRecoveryAccessPending}
        errorMessage={
          isTelegramBotChatRequiredError(submitErrorCode)
            ? undefined
            : submitError
        }
        errorContent={
          isTelegramBotChatRequiredError(submitErrorCode) ? (
            <TelegramBotAccessNotice
              botUsername={botUsername}
              onAccessGranted={handleConfirmedSubmit}
              onPendingChange={setIsRecoveryAccessPending}
            />
          ) : undefined
        }
      />
    </>
  );
}
