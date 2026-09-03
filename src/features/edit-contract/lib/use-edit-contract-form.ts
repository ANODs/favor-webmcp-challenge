import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@/i18n/routing";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import {
  CONTRACT_ERROR_CODES,
  CONTRACT_TITLE_VALIDATION_CODES,
  routes,
} from "@/shared/config";
import {
  CONTRACT_VERSION_CONFLICT_CODE,
  contractQueryKeys,
  contractsClient,
  isContractModerationField,
  moderateContractContent,
  getContractValidationMessage,
  mapContractFormToUpdateDto,
  parseContractVersionConflictDetails,
  type ContractDto,
  type ContractFormFieldErrors,
  type ContractFormState,
  type ContractFormValidationIssue,
} from "@/entities/contract";
import { ApiRequestError } from "@/shared/api";
import { useEditContractDraftStore } from "../model/store";

export function useEditContractForm(
  contract: ContractDto,
  draftOwnerId: number,
) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useTranslations("EditContract");
  const contractT = useTranslations("Contracts");
  const {
    form,
    preview,
    baseForm,
    baseContractUpdatedAt,
    hasHydrated,
    persistenceError: draftPersistenceError,
    wasRestored,
    hasRevisionConflict,
    updateField,
    applyPreview,
    setPreview,
    toggleImage,
    setPrimaryImage,
    acceptLatestRevision,
    discardDraft,
    clearDraft,
  } = useEditContractDraftStore(draftOwnerId, contract);
  const [titleValidation, setTitleValidation] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");
  const [fieldErrors, setFieldErrors] = useState<ContractFormFieldErrors>({});

  const titleValue = (form.titleRu || "").trim() || (form.titleEn || "").trim();
  const canFetchPreview = (form.telegramPostUrl || "").trim().length > 0;
  const previewIsOutdated =
    !!preview && preview.telegramPostUrl !== form.telegramPostUrl.trim();
  const titleIsUnchanged = titleValue === (contract.titleRu?.trim() || contract.titleEn?.trim() || "");
    
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
    !titleValue || titleIsUnchanged || moderationResult.fieldErrors.title
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
        return t("title_validation_failed");
    }
  }, [contractT, t]);

  const getUpdateErrorMessage = (error: unknown) => {
    if (!(error instanceof ApiRequestError)) {
      return t("save_error");
    }

    switch (error.code) {
      case CONTRACT_ERROR_CODES.categoryUnknown:
        return t("category_unknown_error");
      case CONTRACT_ERROR_CODES.contentBlocked:
        return contractT("ModerationFieldError");
      case "AUTH_SESSION_REQUIRED":
        return t("authentication_required_error");
      case "AUTH_SESSION_REFRESH_UNAVAILABLE":
        return t("session_refresh_unavailable_error");
      case "NETWORK_REQUEST_FAILED":
        return t("network_error");
      case "RATE_LIMITED":
        return t("rate_limit_error");
      default:
        return t("save_error");
    }
  };

  useEffect(() => {
    if (!titleValue || titleIsUnchanged || moderationResult.fieldErrors.title) {
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
        setTitleValidation(t("validation_error"));
      }
    }, 400);

    return () => window.clearTimeout(timeoutId);
  }, [contract.id, contract.slug, contract.titleRu, contract.titleEn, getTitleValidationMessage, moderationResult.fieldErrors.title, t, titleIsUnchanged, titleValue]);

  const previewMutation = useMutation({
    mutationFn: (telegramPostUrl: string) =>
      contractsClient.previewTelegramPost(telegramPostUrl),
    onSuccess: (nextPreview) => {
      applyPreview(nextPreview);
      setSubmitError("");
    },
    onError: () => {
      setPreview(null);
      setSubmitError(t("fetch_post_error"));
    },
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      contractsClient.update(
        contract.slug,
        mapContractFormToUpdateDto(
          form,
          baseForm,
          contract.id,
          baseContractUpdatedAt,
        ),
      ),
    onSuccess: (updatedContract) => {
      setSubmitError("");
      setSubmitSuccess(t("save_success"));
      clearDraft();
      router.push(routes.contractBySlug(updatedContract.slug));
    },
    onError: (error) => {
      setSubmitSuccess("");
      if (
        error instanceof ApiRequestError &&
        error.code === CONTRACT_VERSION_CONFLICT_CODE
      ) {
        setSubmitError(t("version_conflict"));
        const conflict = parseContractVersionConflictDetails(error.details);
        const latestSlug =
          conflict?.contractId === contract.id ? conflict.slug : contract.slug;

        void queryClient.invalidateQueries({
          queryKey: contractQueryKeys.detail(contract.slug),
        });
        if (latestSlug !== contract.slug) {
          void queryClient.invalidateQueries({
            queryKey: contractQueryKeys.detail(latestSlug),
          });
          router.replace(routes.editContractBySlug(latestSlug));
        }
        return;
      }

      setSubmitError(getUpdateErrorMessage(error));
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
    if ((field === "titleRu" || field === "titleEn") && typeof value === "string") {
      const nextTitle = value.trim();
      const existingTitle = contract.titleRu?.trim() || contract.titleEn?.trim() || "";

      if (!nextTitle || nextTitle === existingTitle) {
        setTitleValidation("");
      }
    }

    updateField(field, value);

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

  const getFieldError = (field: keyof ContractFormState) =>
    fieldErrors[field] ??
    (isContractModerationField(field) ? moderationResult.fieldErrors[field] : undefined);

  const handleFetchPreview = async () => {
    if (!canFetchPreview) {
      setSubmitError(t("insert_link_first"));
      return;
    }

    setSubmitError("");

    try {
      await previewMutation.mutateAsync((form.telegramPostUrl || "").trim());
    } catch {
      return;
    }
  };

  const prepareSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError("");
    setSubmitSuccess("");
    setFieldErrors({});

    if (moderationResult.isBlocked) {
      setSubmitError("");
      return false;
    }

    if (!(form.telegramPostUrl || "").trim()) {
      setSubmitError(t("link_required"));
      return false;
    }

    if (!preview || previewIsOutdated) {
      setSubmitError(t("refetch_after_link_change"));
      return false;
    }

    return true;
  };

  const submitChanges = async () => {
    try {
      await updateMutation.mutateAsync();
      return true;
    } catch (error) {
      if (error instanceof ApiRequestError && applyValidationIssues(error.details)) {
        setSubmitError("");
      }

      return false;
    }
  };

  return {
    form,
    preview,
    hasHydrated,
    draftPersistenceError,
    wasRestored,
    hasRevisionConflict,
    titleValidation: visibleTitleValidation,
    submitError,
    submitSuccess,
    moderationResult,
    updateMutation,
    previewMutation,
    selectedImagesCount,
    getFieldError,
    updateFormField,
    handleFetchPreview,
    prepareSubmit,
    submitChanges,
    toggleImage,
    setPrimaryImage,
    acceptLatestRevision,
    discardDraft,
  };
}
