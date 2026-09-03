import type {
  ContractDto,
  CreateContractDto,
  UpdateContractDto,
  SupportedEscrowCurrencyDto,
  ContractTypeDto,
  TelegramPostPreviewDto,
} from "../api/dto";
import { isUnclaimedScoutContract } from "./scouting";

export type ContractFormState = {
  titleRu: string;
  titleEn: string;
  descriptionRu: string;
  descriptionEn: string;
  type: ContractTypeDto;
  category: string;
  tagsInput: string;
  basePrice: string;
  deadlineDays: string;
  maxOpenDeals: string;
  telegramPostUrl: string;
  telegramChannelUrl: string;
  cachedTelegramText: string;
  mediaRefs: string[];
  isScouting: boolean;
  scoutedTelegramUsername: string;
  isEscrow: boolean;
  escrowCurrency: SupportedEscrowCurrencyDto;
};

export type ContractFormFieldErrors = Partial<Record<keyof ContractFormState, string>>;

export type ContractFormValidationIssue = {
  code?: string;
  minimum?: number;
  path?: Array<string | number>;
  message?: string;
};

export type ContractFormValidationMessages = {
  titleTooShort: string;
  titleTooLong: string;
  descriptionTooShort: string;
  telegramPostUrlInvalid: string;
  fallback: string;
};

export const defaultContractFormState: ContractFormState = {
  titleRu: "",
  titleEn: "",
  descriptionRu: "",
  descriptionEn: "",
  type: "offer",
  category: "",
  tagsInput: "",
  basePrice: "",
  deadlineDays: "",
  maxOpenDeals: "3",
  telegramPostUrl: "",
  telegramChannelUrl: "",
  cachedTelegramText: "",
  mediaRefs: [],
  isScouting: false,
  scoutedTelegramUsername: "",
  isEscrow: true,
  escrowCurrency: "TON",
};

export const parseTagsInput = (value: string) =>
  value
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);

export const detectContractTextLanguage = (value: string): "ru" | "en" => {
  const cyrillicCharacters = value.match(/\p{Script=Cyrillic}/gu)?.length ?? 0;
  const latinCharacters = value.match(/\p{Script=Latin}/gu)?.length ?? 0;

  return cyrillicCharacters > latinCharacters ? "ru" : "en";
};

export const mapContractFormToCreateDto = (
  form: ContractFormState,
): CreateContractDto => ({
  titleRu: (form.titleRu || "").trim() || null,
  titleEn: (form.titleEn || "").trim() || null,
  descriptionRu: (form.descriptionRu || "").trim() || null,
  descriptionEn: (form.descriptionEn || "").trim() || null,
  type: form.type,
  category: (form.category || "").trim() || null,
  tags: parseTagsInput(form.tagsInput || ""),
  basePrice: form.basePrice ? Number(form.basePrice) : null,
  deadlineDays: form.deadlineDays ? Number(form.deadlineDays) : null,
  maxOpenDeals:
    form.type === "order"
      ? 1
      : form.maxOpenDeals === ""
        ? null
        : Number(form.maxOpenDeals),
  telegramPostUrl: (form.telegramPostUrl || "").trim() || null,
  telegramChannelUrl: (form.telegramChannelUrl || "").trim() || null,
  cachedTelegramText: (form.cachedTelegramText || "").trim() || null,
  mediaRefs: form.mediaRefs || [],
  isScouting: form.isScouting,
  scoutedTelegramUsername: form.isScouting
    ? (form.scoutedTelegramUsername || "").trim() || null
    : null,
  isEscrow: form.isEscrow,
  escrowCurrency:
    form.isEscrow && !form.isScouting
      ? (form.escrowCurrency ?? "TON")
      : "TON",
});

const mapContractFormToUpdateFields = (
  form: ContractFormState,
): Omit<UpdateContractDto, "contractId" | "baseUpdatedAt"> => {
  const updatableFields = { ...mapContractFormToCreateDto(form) };
  delete updatableFields.isScouting;
  delete updatableFields.scoutedTelegramUsername;

  return updatableFields;
};

export const mapContractFormToUpdateDto = (
  form: ContractFormState,
  baseForm: ContractFormState,
  contractId: number,
  baseUpdatedAt: string,
): UpdateContractDto => {
  const currentFields = mapContractFormToUpdateFields(form);
  const baseFields = mapContractFormToUpdateFields(baseForm);
  const changedFields = Object.fromEntries(
    Object.entries(currentFields).filter(([field, value]) =>
      JSON.stringify(value) !==
      JSON.stringify(baseFields[field as keyof typeof baseFields]),
    ),
  ) as Omit<UpdateContractDto, "contractId" | "baseUpdatedAt">;

  return {
    ...changedFields,
    contractId,
    baseUpdatedAt,
  };
};

export const applyTelegramPreviewToForm = (
  form: ContractFormState,
  preview: TelegramPostPreviewDto,
): ContractFormState => {
  const translation = preview.translation;
  const sourceLanguage = detectContractTextLanguage(preview.description);

  return {
    ...form,
    titleRu: translation?.titleRu ?? form.titleRu,
    titleEn: translation?.titleEn ?? form.titleEn,
    descriptionRu:
      translation?.descriptionRu ??
      (sourceLanguage === "ru" ? preview.description : form.descriptionRu),
    descriptionEn:
      translation?.descriptionEn ??
      (sourceLanguage === "en" ? preview.description : form.descriptionEn),
    telegramPostUrl: preview.telegramPostUrl,
    telegramChannelUrl: preview.telegramChannelUrl,
    cachedTelegramText: preview.description,
    mediaRefs: preview.images,
  };
};

export const mapContractToFormState = (contract: ContractDto): ContractFormState => ({
  titleRu: contract.titleRu ?? "",
  titleEn: contract.titleEn ?? "",
  descriptionRu: contract.descriptionRu ?? "",
  descriptionEn: contract.descriptionEn ?? "",
  type: contract.type,
  category: contract.category ?? "",
  tagsInput: contract.tags.join(", "),
  basePrice:
    contract.basePrice === null || contract.basePrice === undefined
      ? ""
      : String(contract.basePrice),
  deadlineDays:
    contract.deadlineDays === null || contract.deadlineDays === undefined
      ? ""
      : String(contract.deadlineDays),
  maxOpenDeals:
    contract.maxOpenDeals === null || contract.maxOpenDeals === undefined
      ? ""
      : String(contract.maxOpenDeals),
  telegramPostUrl: contract.telegramPostUrl ?? "",
  telegramChannelUrl: contract.telegramChannelUrl ?? "",
  cachedTelegramText: contract.cachedTelegramText ?? "",
  mediaRefs: contract.mediaRefs ?? [],
  isScouting: isUnclaimedScoutContract(contract),
  scoutedTelegramUsername: contract.scoutedTelegramUsername ?? "",
  isEscrow: contract.isEscrow,
  escrowCurrency:
    contract.escrowCurrency === "USDT" || contract.escrowCurrency === "USDC"
      ? "USDT"
      : "TON",
});

export const buildPreviewFromContract = (contract: ContractDto): TelegramPostPreviewDto | null => {
  if (!contract.telegramPostUrl || !contract.telegramChannelUrl) {
    return null;
  }

  return {
    telegramPostUrl: contract.telegramPostUrl,
    telegramChannelUrl: contract.telegramChannelUrl,
    description: contract.cachedTelegramText ?? contract.description,
    images: contract.mediaRefs ?? [],
  };
};

export const getContractValidationMessage = (
  issue: ContractFormValidationIssue,
  messages: ContractFormValidationMessages,
): string => {
  const field = issue.path?.[0];

  if ((field === "titleRu" || field === "titleEn") && issue.code === "too_small" && issue.minimum === 5) {
    return messages.titleTooShort;
  }

  if ((field === "titleRu" || field === "titleEn") && issue.code === "too_big") {
    return messages.titleTooLong;
  }

  if ((field === "descriptionRu" || field === "descriptionEn") && issue.code === "too_small" && issue.minimum === 20) {
    return messages.descriptionTooShort;
  }

  if (field === "telegramPostUrl" && issue.code === "invalid_format") {
    return messages.telegramPostUrlInvalid;
  }

  return messages.fallback;
};
