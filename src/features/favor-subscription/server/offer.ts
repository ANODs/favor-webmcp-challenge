import {
  FAVOR_SUBSCRIPTION_DURATION,
  MONTHLY_SUBSCRIPTION_DURATION,
  type FavorSubscriptionRateDto,
  type SubscriptionOfferDto,
} from "@/entities/subscription";
import { SUBSCRIPTION_BENEFITS } from "@/entities/subscription/server";
import {
  getSubscriptionDiscounts,
  getSubscriptionPriceStars,
  getSubscriptionPriceUsdt,
} from "@/shared/lib/pricing";
import { getFavorBurnStats } from "@/shared/lib/ton/server";
import {
  getFavorPriceInGram,
  getGramPriceUsdt,
  getLiveFavorPriceInGram,
} from "@/shared/lib/ton/oracle";

import {
  buildFavorSubscriptionQuote,
  buildGramSubscriptionQuote,
} from "./quote";

const FAVOR_DECIMALS = 1_000_000_000;
const FAVOR_MAX_SUPPLY = 1_000_000_000;
const CHART_POINTS = 12;

type FavorBurnEvent = {
  amount: string;
  timestamp: number;
};

export async function getFavorSubscriptionRate(): Promise<FavorSubscriptionRateDto> {
  const [favorPriceInGram, gramPriceUsdt] = await Promise.all([
    getFavorPriceInGram(),
    getGramPriceUsdt(),
  ]);
  return buildFavorSubscriptionRateContext({ favorPriceInGram, gramPriceUsdt })
    .rate;
}

const buildFavorSubscriptionRateContext = ({
  favorPriceInGram,
  gramPriceUsdt,
}: {
  favorPriceInGram: number;
  gramPriceUsdt: number;
}) => {
  const quote = buildFavorSubscriptionQuote({
    favorPriceInGram,
    gramPriceUsdt,
  });
  const favorAmount = Number(quote.amount);
  if (!Number.isSafeInteger(favorAmount) || favorAmount <= 0) {
    throw new Error("INVALID_FAVOR_SUBSCRIPTION_QUOTE");
  }
  const yearlyPriceUsdt = getSubscriptionPriceUsdt(FAVOR_SUBSCRIPTION_DURATION);
  const discountedPriceUsdt = quote.priceUsdt;

  return {
    quote,
    rate: {
      favorPriceInTon: favorPriceInGram,
      favorPriceUsdt: quote.favorPriceUsdt,
      gramPriceUsdt,
      yearlyPriceTon: yearlyPriceUsdt / gramPriceUsdt,
      discountedPriceTon: discountedPriceUsdt / gramPriceUsdt,
      yearlyPriceUsdt,
      discountedPriceUsdt,
      favorAmount,
    } satisfies FavorSubscriptionRateDto,
  };
};

export async function getSubscriptionOffer(): Promise<SubscriptionOfferDto> {
  const gramPriceUsdt = await getGramPriceUsdt();
  let favorRate: FavorSubscriptionRateDto | null = null;
  let favorAmount: string | null = null;
  let favorAmountNano: string | null = null;

  try {
    const favorPriceInGram = await getLiveFavorPriceInGram();
    if (favorPriceInGram !== null) {
      const favorContext = buildFavorSubscriptionRateContext({
        favorPriceInGram,
        gramPriceUsdt,
      });
      favorRate = favorContext.rate;
      favorAmount = favorContext.quote.amount;
      favorAmountNano = favorContext.quote.amountNano.toString();
    }
  } catch (error) {
    console.error("[subscription-offer] FAVOR quote unavailable", error);
  }

  const discounts = getSubscriptionDiscounts();
  const monthlyGram = buildGramSubscriptionQuote({
    duration: MONTHLY_SUBSCRIPTION_DURATION,
    gramPriceUsdt,
  });
  const yearlyGram = buildGramSubscriptionQuote({
    duration: FAVOR_SUBSCRIPTION_DURATION,
    gramPriceUsdt,
  });

  return {
    plans: [
      {
        duration: MONTHLY_SUBSCRIPTION_DURATION,
        priceUsdt: getSubscriptionPriceUsdt(MONTHLY_SUBSCRIPTION_DURATION),
        telegramStars: {
          amount: getSubscriptionPriceStars(MONTHLY_SUBSCRIPTION_DURATION),
        },
        gram: {
          amount: monthlyGram.amount,
          amountNano: monthlyGram.amountNano.toString(),
        },
        favor: null,
      },
      {
        duration: FAVOR_SUBSCRIPTION_DURATION,
        priceUsdt: getSubscriptionPriceUsdt(FAVOR_SUBSCRIPTION_DURATION),
        telegramStars: {
          amount: getSubscriptionPriceStars(FAVOR_SUBSCRIPTION_DURATION),
        },
        gram: {
          amount: yearlyGram.amount,
          amountNano: yearlyGram.amountNano.toString(),
        },
        favor: favorRate && favorAmount && favorAmountNano
          ? {
              amount: favorAmount,
              amountNano: favorAmountNano,
              priceUsdt: favorRate.discountedPriceUsdt,
            }
          : null,
      },
    ],
    benefits: SUBSCRIPTION_BENEFITS.map((benefit) => ({ ...benefit })),
    discounts,
    favorRate,
  };
}

const fromNanoFavor = (amountNano: string | bigint) =>
  Number(BigInt(amountNano)) / FAVOR_DECIMALS;

const toChartPoint = ({
  name,
  burned,
  maxSupply,
}: {
  name: string;
  burned: number;
  maxSupply: number;
}) => {
  const normalizedBurned = Math.max(0, burned);

  return {
    name,
    burned: normalizedBurned,
    supply: Math.max(0, maxSupply - normalizedBurned),
  };
};

const formatChartPointName = (timestamp: number, index: number) => {
  if (!timestamp) return `Point ${index + 1}`;

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(timestamp * 1000));
};

const buildFallbackChartData = (burnedTokens: number, maxSupply: number) =>
  Array.from({ length: CHART_POINTS }, (_, index) => {
    const fraction = index / (CHART_POINTS - 1);
    const burned = index === CHART_POINTS - 1
      ? burnedTokens
      : burnedTokens * Math.pow(fraction, 1.4);

    return toChartPoint({ name: `Point ${index + 1}`, burned, maxSupply });
  });

const buildBurnChartData = ({
  burnedTokens,
  maxSupply,
  burnEvents,
}: {
  burnedTokens: number;
  maxSupply: number;
  burnEvents: FavorBurnEvent[];
}) => {
  const recentEvents = burnEvents
    .filter((event) => {
      try {
        return BigInt(event.amount) > 0n;
      } catch {
        return false;
      }
    })
    .slice(-CHART_POINTS);

  if (recentEvents.length === 0) {
    return buildFallbackChartData(burnedTokens, maxSupply);
  }

  const eventAmounts = recentEvents.map((event) => fromNanoFavor(event.amount));
  const eventTotal = eventAmounts.reduce((sum, amount) => sum + amount, 0);
  const startingBurned = Math.max(0, burnedTokens - eventTotal);
  let cumulativeBurned = startingBurned;
  const eventPoints = recentEvents.map((event, index) => {
    cumulativeBurned += eventAmounts[index];

    return toChartPoint({
      name: formatChartPointName(event.timestamp, index),
      burned: index === recentEvents.length - 1
        ? burnedTokens
        : Math.min(burnedTokens, cumulativeBurned),
      maxSupply,
    });
  });

  if (eventPoints.length >= CHART_POINTS) return eventPoints;

  const prefixPoints = Array.from(
    { length: CHART_POINTS - eventPoints.length },
    (_, index) => toChartPoint({
      name: `Point ${index + 1}`,
      burned: startingBurned,
      maxSupply,
    }),
  );

  return [...prefixPoints, ...eventPoints];
};

export async function getFavorHubStats() {
  const stats = await getFavorBurnStats();
  const burnedTokens = fromNanoFavor(stats.burnedAmount);
  const maxSupply = FAVOR_MAX_SUPPLY;
  const circulatingSupply = Math.max(0, maxSupply - burnedTokens);

  return {
    maxSupply,
    totalBurned: burnedTokens,
    circulatingSupply,
    burnPercent: (burnedTokens / maxSupply) * 100,
    burnWalletAddress: stats.burnWalletAddress,
    burnJettonWalletAddress: stats.burnJettonWalletAddress,
    isInitialized: stats.isInitialized,
    chartData: buildBurnChartData({
      burnedTokens,
      maxSupply,
      burnEvents: stats.burnEvents,
    }),
  };
}
