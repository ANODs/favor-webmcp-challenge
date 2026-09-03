import { Prisma } from "@prisma/client";

import {
  FAVOR_SUBSCRIPTION_DURATION,
  SUBSCRIPTION_QUOTE_CHANGED_CODE,
  type SubscriptionDuration,
} from "@/entities/subscription";
import { ApplicationError } from "@/shared/lib/application-error";
import { getSubscriptionPriceUsdt } from "@/shared/lib/pricing";

const NANO_SCALE = 1_000_000_000n;
const GRAM_QUOTE_QUANTUM_NANO = 1_000_000n;
const FAVOR_QUOTE_QUANTUM_NANO = NANO_SCALE;

const requirePositiveDecimal = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("INVALID_SUBSCRIPTION_QUOTE");
  }

  return new Prisma.Decimal(value);
};

const ceilToQuantum = (amountNano: bigint, quantumNano: bigint) =>
  ((amountNano + quantumNano - 1n) / quantumNano) * quantumNano;

const calculateAmountNano = ({
  priceUsdt,
  assetPriceUsdt,
  quantumNano,
}: {
  priceUsdt: number;
  assetPriceUsdt: number;
  quantumNano: bigint;
}) => {
  const rawAmountNano = requirePositiveDecimal(priceUsdt)
    .div(requirePositiveDecimal(assetPriceUsdt))
    .mul(NANO_SCALE.toString())
    .ceil();

  return ceilToQuantum(BigInt(rawAmountNano.toFixed(0)), quantumNano);
};

export const buildGramSubscriptionQuote = ({
  duration,
  gramPriceUsdt,
}: {
  duration: SubscriptionDuration;
  gramPriceUsdt: number;
}) => {
  const amountNano = calculateAmountNano({
    priceUsdt: getSubscriptionPriceUsdt(duration),
    assetPriceUsdt: gramPriceUsdt,
    quantumNano: GRAM_QUOTE_QUANTUM_NANO,
  });

  return {
    amountNano,
    amount: new Prisma.Decimal(amountNano.toString())
      .div(NANO_SCALE.toString())
      .toFixed(3),
  };
};

export const buildFavorSubscriptionQuote = ({
  favorPriceInGram,
  gramPriceUsdt,
}: {
  favorPriceInGram: number;
  gramPriceUsdt: number;
}) => {
  const favorPriceUsdt = requirePositiveDecimal(favorPriceInGram)
    .mul(requirePositiveDecimal(gramPriceUsdt))
    .toNumber();
  const priceUsdt = getSubscriptionPriceUsdt(
    FAVOR_SUBSCRIPTION_DURATION,
    "FAVOR",
  );
  const amountNano = calculateAmountNano({
    priceUsdt,
    assetPriceUsdt: favorPriceUsdt,
    quantumNano: FAVOR_QUOTE_QUANTUM_NANO,
  });

  return {
    amountNano,
    amount: (amountNano / NANO_SCALE).toString(),
    favorPriceUsdt,
    priceUsdt,
  };
};

export const assertExpectedSubscriptionQuote = ({
  asset,
  expectedAmountNano,
  actualAmountNano,
}: {
  asset: "FAVOR" | "GRAM";
  expectedAmountNano: string;
  actualAmountNano: bigint;
}) => {
  if (expectedAmountNano === actualAmountNano.toString()) return;

  throw new ApplicationError(
    SUBSCRIPTION_QUOTE_CHANGED_CODE,
    "The subscription quote changed. Review the updated price and try again.",
    409,
    { asset },
  );
};
