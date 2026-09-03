import type {
  ContractFormFieldErrors,
  ContractFormState,
} from "@/entities/contract";
import {
  CONTRACT_TITLE_MAX_LENGTH,
  CONTRACT_TITLE_MIN_LENGTH,
} from "@/shared/config";

export type ContractLanguage = "ru" | "en";

export type ContentStepValidationMessages = {
  atLeastOneVersion: string;
  titleRequired: string;
  titleTooShort: string;
  titleTooLong: string;
  descriptionRequired: string;
  descriptionTooShort: string;
};

type LanguageFields = {
  title: keyof Pick<ContractFormState, "titleRu" | "titleEn">;
  description: keyof Pick<
    ContractFormState,
    "descriptionRu" | "descriptionEn"
  >;
};

const LANGUAGE_FIELDS: Record<ContractLanguage, LanguageFields> = {
  ru: {
    title: "titleRu",
    description: "descriptionRu",
  },
  en: {
    title: "titleEn",
    description: "descriptionEn",
  },
};

export type ContentStepValidationResult = {
  errors: ContractFormFieldErrors;
  isValid: boolean;
  preferredLanguage: ContractLanguage;
};

export function isContractLanguageVersionComplete(
  form: ContractFormState,
  language: ContractLanguage,
) {
  const fields = LANGUAGE_FIELDS[language];

  return (
    form[fields.title].trim().length >= CONTRACT_TITLE_MIN_LENGTH &&
    form[fields.title].trim().length <= CONTRACT_TITLE_MAX_LENGTH &&
    form[fields.description].trim().length >= 20
  );
}

export function validateContractContentStep(
  form: ContractFormState,
  messages: ContentStepValidationMessages,
): ContentStepValidationResult {
  const errors: ContractFormFieldErrors = {};
  const startedLanguages: ContractLanguage[] = [];
  const completeLanguages: ContractLanguage[] = [];

  for (const language of Object.keys(LANGUAGE_FIELDS) as ContractLanguage[]) {
    const fields = LANGUAGE_FIELDS[language];
    const title = form[fields.title].trim();
    const description = form[fields.description].trim();
    const isStarted = title.length > 0 || description.length > 0;

    if (!isStarted) {
      continue;
    }

    startedLanguages.push(language);

    if (!title) {
      errors[fields.title] = messages.titleRequired;
    } else if (title.length < CONTRACT_TITLE_MIN_LENGTH) {
      errors[fields.title] = messages.titleTooShort;
    } else if (title.length > CONTRACT_TITLE_MAX_LENGTH) {
      errors[fields.title] = messages.titleTooLong;
    }

    if (!description) {
      errors[fields.description] = messages.descriptionRequired;
    } else if (description.length < 20) {
      errors[fields.description] = messages.descriptionTooShort;
    }

    if (isContractLanguageVersionComplete(form, language)) {
      completeLanguages.push(language);
    }
  }

  if (startedLanguages.length === 0) {
    errors.titleRu = messages.atLeastOneVersion;
  }

  const preferredLanguage =
    (startedLanguages.find((language) => {
      const fields = LANGUAGE_FIELDS[language];
      return Boolean(errors[fields.title] || errors[fields.description]);
    }) as ContractLanguage | undefined) ??
    completeLanguages[0] ??
    "ru";

  return {
    errors,
    isValid:
      completeLanguages.length > 0 && Object.keys(errors).length === 0,
    preferredLanguage,
  };
}
