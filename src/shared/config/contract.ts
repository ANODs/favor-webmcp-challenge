export const CONTRACT_TITLE_MIN_LENGTH = 5;
export const CONTRACT_TITLE_MAX_LENGTH = 120;
export const CONTRACT_PRICE_MAX_USD = 99_999_999.99;
export const CONTRACT_PRICE_STEP_USD = 0.01;

export const CONTRACT_TITLE_VALIDATION_CODES = {
  tooShort: "CONTRACT_TITLE_TOO_SHORT",
  tooLong: "CONTRACT_TITLE_TOO_LONG",
  contentBlocked: "CONTRACT_TITLE_CONTENT_BLOCKED",
} as const;

export type ContractTitleValidationCode =
  (typeof CONTRACT_TITLE_VALIDATION_CODES)[keyof typeof CONTRACT_TITLE_VALIDATION_CODES];

export const CONTRACT_ERROR_CODES = {
  categoryUnknown: "CONTRACT_CATEGORY_UNKNOWN",
  categoryRequired: "CONTRACT_CATEGORY_REQUIRED",
  duplicateRecent: "CONTRACT_DUPLICATE_RECENT",
  limitReached: "CONTRACT_LIMIT_REACHED",
  contentBlocked: "CONTRACT_CONTENT_BLOCKED",
  scoutPostRequired: "CONTRACT_SCOUT_POST_REQUIRED",
  slugEmpty: "CONTRACT_SLUG_EMPTY",
} as const;

export type ContractErrorCode =
  (typeof CONTRACT_ERROR_CODES)[keyof typeof CONTRACT_ERROR_CODES];
