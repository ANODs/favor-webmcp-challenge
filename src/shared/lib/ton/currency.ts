export const NATIVE_TOKEN_TICKER = "GRAM" as const;

export const getEscrowCurrencyDisplayName = (currency: string) =>
  currency === "TON" ? NATIVE_TOKEN_TICKER : currency;
