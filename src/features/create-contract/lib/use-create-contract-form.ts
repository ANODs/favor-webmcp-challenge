import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "@/i18n/routing";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { createStore, useStore } from "zustand";

import {
  CONTRACT_ERROR_CODES,
  CONTRACT_TITLE_VALIDATION_CODES,
  routes,
} from "@/shared/config";
import {
  moderateContractContent,
  getContractValidationMessage,
  mapContractFormToCreateDto,
  type ContractFormFieldErrors,
  type ContractFormState,
  type ContractFormValidationIssue,
} from "@/entities/contract";
import { useCreateContractDraftStore } from "../model/store";
import { claimAnonymousCreateContractDraft } from "../model/draft-persistence";
import {
  planCreateContractDraftOwnerTransition,
  type CreateContractDraftOwnerId,
} from "../model/draft-owner";
import { ApiRequestError } from "@/shared/api";
import { contractsClient } from "@/entities/contract";
import { TELEGRAM_BOT_ACCESS_ERROR_CODES } from "@/entities/user";
import { authClient, sessionQueryKeys } from "@/entities/session";
import { requestTelegramWriteAccess } from "@/shared/lib/telegram";
import {
  validateContractContentStep,
  type ContentStepValidationMessages,
} from "./content-step-validation";

const claimAnonymousDraft = (ownerId: number) => {
  try {
    return claimAnonymousCreateContractDraft(window.localStorage, ownerId);
  } catch {
    return "failed" as const;
  }
};

type DraftOwnerState = {
  ownerId: CreateContractDraftOwnerId;
};

export function useCreateContractForm({
  publicationDraftToken,
}: {
  publicationDraftToken?: string;
} = {}) {
  const router = useRouter();
  const t = useTranslations("CreateContract");
  const contractT = useTranslations("Contracts");
  const [titleValidation, setTitleValidation] = useState<string>("");
  const [submitError, setSubmitError] = useState<string>("");
  const [submitErrorCode, setSubmitErrorCode] = useState<string>();
  const [submitSuccess, setSubmitSuccess] = useState<string>("");
  const [isSubmitPending, setIsSubmitPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<ContractFormFieldErrors>({});
  const isSubmitPendingRef = useRef(false);
  const meQuery = useQuery({
    queryKey: sessionQueryKeys.currentUser,
    queryFn: authClient.getMe,
  });
  const resolvedDraftOwnerId = meQuery.data
    ? meQuery.data.id
    : meQuery.isPending || meQuery.isError
      ? undefined
      : null;
  const [draftOwnerStore] = useState(() =>
    createStore<DraftOwnerState>()(() => ({ ownerId: undefined })),
  );
  const draftOwnerId = useStore(
    draftOwnerStore,
    (state) => state.ownerId,
  );

  useEffect(() => {
    const currentOwnerId = draftOwnerStore.getState().ownerId;
    const transition = planCreateContractDraftOwnerTransition(
      currentOwnerId,
      resolvedDraftOwnerId,
    );

    if (transition.kind === "keep") {
      return;
    }

    if (transition.kind === "select") {
      draftOwnerStore.setState({ ownerId: transition.ownerId });
      return;
    }

    const claimResult = claimAnonymousDraft(transition.ownerId);
    draftOwnerStore.setState({
      ownerId:
        claimResult === "failed"
          ? transition.fallbackOwnerId
          : transition.ownerId,
    });
  }, [draftOwnerStore, resolvedDraftOwnerId]);
  
  const {
    form,
    preview,
    addTelegramPostButton,
    hasHydrated: hasDraftHydrated,
    persistenceError: draftPersistenceError,
    updateField,
    applyPreview,
    setPreview,
    replaceDraft,
    setAddTelegramPostButton,
    clearTelegramSource,
    toggleImage,
    setPrimaryImage,
    resetDraft,
    lastClaimedToken,
    setLastClaimedToken,
  } = useCreateContractDraftStore(draftOwnerId);
  const hasHydrated = draftOwnerId !== undefined && hasDraftHydrated;

  const titleValue = (form.titleRu || "").trim() || (form.titleEn || "").trim();
  const canFetchPreview = (form.telegramPostUrl || "").trim().length > 0;
  
  const moderationResult = useMemo(
    () =>
      moderateContractContent({
        title: form.titleRu || form.titleEn,
        description: form.descriptionRu || form.descriptionEn,
        category: form.category,
        tagsInput: form.tagsInput,
      }, {
        fieldLabels: {
          title: contractT("ModerationFieldTitle"),
          description: contractT("ModerationFieldDescription"),
          category: contractT("ModerationFieldCategory"),
          tagsInput: contractT("ModerationFieldTags"),
        },
        fieldError: contractT("ModerationFieldError"),
        formatSummary: (fields) =>
          contractT("ModerationSummary", { fields: fields.join(", ") }),
      }),
    [contractT, form.category, form.descriptionRu, form.descriptionEn, form.tagsInput, form.titleRu, form.titleEn],
  );
  const visibleTitleValidation =
    !hasHydrated || !titleValue || moderationResult.fieldErrors.title
      ? ""
      : titleValidation;

  const getTitleValidationMessage = useCallback((code?: string) => {
    switch (code) {
      case CONTRACT_TITLE_VALIDATION_CODES.tooShort:
        return contractT("ValidationTitleTooShort");
      case CONTRACT_TITLE_VALIDATION_CODES.tooLong:
        return contractT("ValidationTitleTooLong");
      case CONTRACT_TITLE_VALIDATION_CODES.contentBlocked:
        return contractT("ModerationFieldError");
      default:
        return t("TitleValidationFailed");
    }
  }, [contractT, t]);

  const getCreateErrorMessage = (error: unknown) => {
    if (!(error instanceof ApiRequestError)) {
      return t("CreateError");
    }

    switch (error.code) {
      case CONTRACT_ERROR_CODES.categoryUnknown:
        return t("CategoryUnknownError");
      case CONTRACT_ERROR_CODES.categoryRequired:
        return t("CategoryRequiredError");
      case CONTRACT_ERROR_CODES.duplicateRecent:
        return t("DuplicateRecentError");
      case CONTRACT_ERROR_CODES.limitReached:
        return t("ContractLimitError");
      case CONTRACT_ERROR_CODES.contentBlocked:
        return contractT("ModerationFieldError");
      case CONTRACT_ERROR_CODES.scoutPostRequired:
        return t("ScoutPostRequiredError");
      case "AUTH_SESSION_REQUIRED":
        return t("AuthenticationRequiredError");
      case "AUTH_SESSION_REFRESH_UNAVAILABLE":
        return t("SessionRefreshUnavailableError");
      case "NETWORK_REQUEST_FAILED":
        return t("NetworkError");
      case "RATE_LIMITED":
        return t("RateLimitError");
      default:
        return t("CreateError");
    }
  };

  useEffect(() => {
    if (
      !hasHydrated ||
      titleValue.length < 5 ||
      moderationResult.fieldErrors.title
    ) {
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      try {
        const validation = await contractsClient.validateTitle(titleValue);

        if (!validation.ok) {
          setTitleValidation(getTitleValidationMessage(validation.code));
          return;
        }

        setTitleValidation("");
      } catch {
        setTitleValidation(t("ValidationError"));
      }
    }, 400);

    return () => window.clearTimeout(timeoutId);
  }, [getTitleValidationMessage, hasHydrated, moderationResult.fieldErrors.title, t, titleValue]);

  const previewMutation = useMutation({
    mutationFn: (telegramPostUrl: string) =>
      contractsClient.previewTelegramPost(telegramPostUrl),
    onSuccess: (nextPreview) => {
      applyPreview(nextPreview);
      setSubmitError("");
      setSubmitErrorCode(undefined);
    },
    onError: () => {
      setPreview(null);
      setSubmitError(t("FetchPostError"));
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const createdContract = await contractsClient.create(
        mapContractFormToCreateDto(form),
        { publicationDraftToken },
      );

      if (
        addTelegramPostButton &&
        !form.isScouting &&
        form.telegramPostUrl.trim()
      ) {
        try {
          await contractsClient.syncTelegramPostButton(createdContract.slug);
        } catch (error) {
          console.warn(
            "[create-contract] Telegram post button was not synchronized",
            { contractId: createdContract.id, error },
          );
        }
      }

      return createdContract;
    },
    onSuccess: (createdContract) => {
      setSubmitError("");
      setSubmitErrorCode(undefined);
      setSubmitSuccess(t("CreateSuccess"));
      resetDraft();
      router.replace(routes.contractBySlug(createdContract.slug));
    },
    onError: (error) => {
      setSubmitSuccess("");
      setSubmitErrorCode(
        error instanceof ApiRequestError ? error.code : undefined,
      );
      setSubmitError(getCreateErrorMessage(error));
    },
  });

  const selectedImagesCount = useMemo(() => form.mediaRefs.length, [form.mediaRefs.length]);

  const applyValidationIssues = (details: unknown) => {
    if (!Array.isArray(details)) {
      return false;
    }

    const nextFieldErrors: ContractFormFieldErrors = {};

    for (const issue of details as ContractFormValidationIssue[]) {
      const field = issue.path?.[0];
      const message = getContractValidationMessage(issue, {
        titleTooShort: contractT("ValidationTitleTooShort"),
        titleTooLong: contractT("ValidationTitleTooLong"),
        descriptionTooShort: contractT("ValidationDescriptionTooShort"),
        telegramPostUrlInvalid: contractT("ValidationTelegramPostUrlInvalid"),
        fallback: contractT("ValidationGeneric"),
      });

      if (
        typeof field === "string" &&
        field in form &&
        !nextFieldErrors[field as keyof ContractFormState]
      ) {
        nextFieldErrors[field as keyof ContractFormState] = message;
      }
    }

    if (Object.keys(nextFieldErrors).length === 0) {
      return false;
    }

    setFieldErrors(nextFieldErrors);
    return true;
  };

  const updateFormField = <T extends keyof ContractFormState>(
    field: T,
    value: ContractFormState[T],
  ) => {
    updateField(field, value);

    if (field === "isScouting" && value === true) {
      setAddTelegramPostButton(false);
      updateField("isEscrow", false);
      updateField("escrowCurrency", "TON");
    }

    if (field === "isEscrow" && value === false) {
      updateField("escrowCurrency", "TON");
    }

    if ((field === "titleRu" || field === "titleEn") && typeof value === "string" && !value.trim() && !titleValue) {
      setTitleValidation("");
    }

    setFieldErrors((current) => {
      if (!current[field]) {
        return current;
      }

      return {
        ...current,
        [field]: undefined,
      };
    });
  };

  const getFieldError = (field: keyof ContractFormState) => {
    if (fieldErrors[field]) {
      return fieldErrors[field];
    }

    if (field === "titleRu" || field === "titleEn") {
      return moderationResult.fieldErrors.title;
    }

    if (field === "descriptionRu" || field === "descriptionEn") {
      return moderationResult.fieldErrors.description;
    }

    if (field === "category" || field === "tagsInput") {
      return moderationResult.fieldErrors[field];
    }

    return undefined;
  };

  const validateContentStep = (
    messages: ContentStepValidationMessages,
  ) => {
    const result = validateContractContentStep(form, messages);
    setFieldErrors(result.errors);
    return result;
  };

  const handleFetchPreview = async () => {
    if (!canFetchPreview) {
      setSubmitError(t("InsertLinkFirst"));
      return;
    }

    setSubmitError("");

    try {
      await previewMutation.mutateAsync((form.telegramPostUrl || "").trim());
    } catch {
      return;
    }
  };

  const clearSubmitError = () => {
    setSubmitError("");
    setSubmitErrorCode(undefined);
  };

  const submitContract = async () => {
    if (isSubmitPendingRef.current) {
      return { ok: false as const, reason: "pending" as const };
    }

    isSubmitPendingRef.current = true;
    setIsSubmitPending(true);

    try {
      setSubmitError("");
      setSubmitErrorCode(undefined);
      setSubmitSuccess("");

      if (moderationResult.isBlocked) {
        return { ok: false as const, reason: "moderation" as const };
      }

      const telegramWriteAccess = await requestTelegramWriteAccess();

      if (telegramWriteAccess === "denied") {
        setSubmitErrorCode(TELEGRAM_BOT_ACCESS_ERROR_CODES.chatRequired);
        return { ok: false as const, reason: "telegram_access" as const };
      }

      try {
        await createMutation.mutateAsync();
        return { ok: true as const };
      } catch (error) {
        if (
          error instanceof ApiRequestError &&
          applyValidationIssues(error.details)
        ) {
          setSubmitError("");
          setSubmitErrorCode(undefined);
          return { ok: false as const, reason: "validation" as const };
        }

        return { ok: false as const, reason: "request" as const };
      }
    } finally {
      isSubmitPendingRef.current = false;
      setIsSubmitPending(false);
    }
  };

  return {
    form,
    preview,
    addTelegramPostButton,
    hasHydrated,
    draftPersistenceError,
    titleValidation: visibleTitleValidation,
    submitError,
    submitErrorCode,
    submitSuccess,
    isSubmitPending,
    moderationResult,
    createMutation,
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
  };
}
