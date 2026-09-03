export const accountRestrictionReasonCodes = [
  "spam",
  "fraud",
  "abuse",
  "compromised",
  "manual_review",
] as const;

export type AccountRestrictionReasonCode =
  (typeof accountRestrictionReasonCodes)[number];

export const isAccountRestrictionReasonCode = (
  value: string,
): value is AccountRestrictionReasonCode =>
  accountRestrictionReasonCodes.some((code) => code === value);
