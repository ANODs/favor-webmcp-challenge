import { env, type StablecoinSymbol } from "@/shared/config/env";

export type EscrowCurrencyCode = "TON" | StablecoinSymbol;

export const STABLECOIN_SYMBOLS: StablecoinSymbol[] = ["USDT"];

export const isStablecoinSymbol = (value: unknown): value is StablecoinSymbol =>
  value === "USDT";

export const isStablecoinEscrowCurrency = (
  value: unknown,
): value is StablecoinSymbol => isStablecoinSymbol(value);

export const getStablecoinJettonConfig = (symbol: StablecoinSymbol) =>
  env.requireStablecoinJetton(symbol);

export const toJettonUnits = (value: number | string, decimals: number) => {
  const normalized = String(value).trim();

  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new Error("Invalid stablecoin amount");
  }

  const [wholePart, fractionPart = ""] = normalized.split(".");
  const paddedFraction = fractionPart.padEnd(decimals, "0").slice(0, decimals);

  return BigInt(wholePart) * (10n ** BigInt(decimals)) + BigInt(paddedFraction || "0");
};

export const formatStablecoinAmount = (
  rawAmount: bigint | number | string | null | undefined,
  decimals: number,
  symbol: StablecoinSymbol,
) => {
  if (rawAmount === null || rawAmount === undefined) {
    return "";
  }

  const amount = BigInt(String(rawAmount));
  const divisor = 10n ** BigInt(decimals);
  const whole = amount / divisor;
  const fraction = amount % divisor;

  if (fraction === 0n) {
    return `${whole.toString()} ${symbol}`;
  }

  const fractionText = fraction
    .toString()
    .padStart(decimals, "0")
    .replace(/0+$/, "");

  return `${whole.toString()}.${fractionText} ${symbol}`;
};
