import { env } from "@/shared/config/env";

const STON_ASSET_API = "https://api.ston.fi/v1/assets";
const GRAM_ASSET_ADDRESS = "EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c";

type StonAssetResponse = {
  asset?: {
    dex_price_usd?: string;
    dex_usd_price?: string;
  };
};

type StonPoolResponse = {
  pool_list?: Array<{
    reserve0: string;
    reserve1: string;
    token0_address: string;
    token1_address: string;
    lp_total_supply_usd?: string;
  }>;
};

const positiveNumber = (value: unknown) => {
  const parsed = typeof value === "string" || typeof value === "number" ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const fetchAssetUsdPrice = async (address: string) => {
  const response = await fetch(`${STON_ASSET_API}/${address}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 60 },
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as StonAssetResponse;
  return positiveNumber(data.asset?.dex_price_usd ?? data.asset?.dex_usd_price);
};

const fetchFavorGramPoolPrice = async (favorAddress: string) => {
  const response = await fetch(
    `https://api.ston.fi/v1/pools/by_market/${favorAddress}/${GRAM_ASSET_ADDRESS}`,
    { headers: { Accept: "application/json" }, next: { revalidate: 60 } },
  );
  if (!response.ok) return null;

  const data = (await response.json()) as StonPoolResponse;
  const pool = [...(data.pool_list ?? [])].sort(
    (left, right) =>
      Number(right.lp_total_supply_usd ?? 0) - Number(left.lp_total_supply_usd ?? 0),
  )[0];
  if (!pool) return null;

  const reserve0 = positiveNumber(pool.reserve0);
  const reserve1 = positiveNumber(pool.reserve1);
  if (!reserve0 || !reserve1) return null;
  if (pool.token0_address === GRAM_ASSET_ADDRESS && pool.token1_address === favorAddress) {
    return reserve0 / reserve1;
  }
  if (pool.token1_address === GRAM_ASSET_ADDRESS && pool.token0_address === favorAddress) {
    return reserve1 / reserve0;
  }
  return null;
};

/** Current GRAM price in USDT (USD and USDT are treated as 1:1 for quoting). */
export async function getGramPriceUsdt(): Promise<number> {
  try {
    return (await fetchAssetUsdPrice(GRAM_ASSET_ADDRESS)) ?? env.gramUsdtFallbackPrice;
  } catch (error) {
    console.error("[getGramPriceUsdt] STON.fi request failed", error);
    return env.gramUsdtFallbackPrice;
  }
}

/** FAVOR/GRAM quote protected by configurable circuit-breaker bounds. */
export async function getLiveFavorPriceInGram(): Promise<number | null> {
  const floor = positiveNumber(env.favorOracleMinPriceTon) ?? 0.00000001;
  const ceiling = positiveNumber(env.favorOracleMaxPriceTon) ?? 0.1;
  let quote: number | null = null;

  try {
    const [favorUsdt, gramUsdt] = await Promise.all([
      fetchAssetUsdPrice(env.requireFavorJettonMasterAddress()),
      fetchAssetUsdPrice(GRAM_ASSET_ADDRESS),
    ]);
    if (favorUsdt && gramUsdt) {
      quote = favorUsdt / gramUsdt;
    } else {
      quote = await fetchFavorGramPoolPrice(env.requireFavorJettonMasterAddress());
    }
  } catch (error) {
    console.error("[getFavorPriceInGram] STON.fi request failed", error);
  }

  return quote === null
    ? null
    : Math.min(ceiling, Math.max(floor, quote));
}

/** FAVOR/GRAM quote protected by configurable circuit-breaker bounds and fallback. */
export async function getFavorPriceInGram(): Promise<number> {
  const fallback = positiveNumber(env.favorOracleFallbackPriceTon) ?? 0.001;
  return (await getLiveFavorPriceInGram()) ?? fallback;
}

export async function getFavorPriceUsdt(): Promise<number> {
  const [favorPerGram, gramUsdt] = await Promise.all([
    getFavorPriceInGram(),
    getGramPriceUsdt(),
  ]);
  return favorPerGram * gramUsdt;
}

// Compatibility aliases. The project historically called GRAM "TON" internally.
export const getFavorPriceInTon = getFavorPriceInGram;
export const getTonUsdPrice = getGramPriceUsdt;
