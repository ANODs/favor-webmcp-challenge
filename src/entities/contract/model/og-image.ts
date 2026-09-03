import ogRenderer from "../og-renderer.json";
import englishOgCopy from "../og-copy.en.json";
import russianOgCopy from "../og-copy.ru.json";

export const CONTRACT_OG_RENDERER_VERSION = ogRenderer.version;

export const CONTRACT_OG_COVER_STATE_HEADER = "X-Favor-Contract-Og-Cover";
export const CONTRACT_OG_COVER_STATE = {
  embedded: "embedded",
  none: "none",
  unavailable: "unavailable",
} as const;

export type ContractOgCoverState =
  (typeof CONTRACT_OG_COVER_STATE)[keyof typeof CONTRACT_OG_COVER_STATE];

export const isContractOgCoverStatePersistable = (
  value: string | null,
): value is
  | typeof CONTRACT_OG_COVER_STATE.embedded
  | typeof CONTRACT_OG_COVER_STATE.none =>
  value === CONTRACT_OG_COVER_STATE.embedded ||
  value === CONTRACT_OG_COVER_STATE.none;

const CONTRACT_OG_IMMUTABLE_CACHE_CONTROL =
  "public, max-age=31536000, immutable";
const CONTRACT_OG_RETRY_CACHE_CONTROL =
  "public, max-age=0, s-maxage=60, must-revalidate";

export const getContractOgCacheControl = (coverState: ContractOgCoverState) =>
  coverState === CONTRACT_OG_COVER_STATE.unavailable
    ? CONTRACT_OG_RETRY_CACHE_CONTROL
    : CONTRACT_OG_IMMUTABLE_CACHE_CONTROL;

const CONTRACT_MEDIA_HOST_SUFFIXES = [
  "telesco.pe",
  "telegram.org",
  "cdn-telegram.org",
] as const;

export const formatContractOgDeadlineDays = (
  days: number,
  locale: "ru" | "en",
) => {
  const copy = locale === "en" ? englishOgCopy : russianOgCopy;
  return `${days} ${copy.deadlineDaysShort}`;
};

type ContractOgImagePathInput = {
  slug: string;
  locale: "ru" | "en";
  updatedAt: Date;
};

type ContractOgRichMediaCacheKeyInput = {
  contractId: number;
  locale: "ru" | "en";
  updatedAt: Date;
};

export const buildContractOgImagePath = ({
  slug,
  locale,
  updatedAt,
}: ContractOgImagePathInput) => {
  const searchParams = new URLSearchParams({
    locale,
    v: String(updatedAt.getTime()),
    renderer: CONTRACT_OG_RENDERER_VERSION,
  });

  return `/api/contracts/${encodeURIComponent(slug)}/og-image.png?${searchParams.toString()}`;
};

export const buildContractOgRichMediaCacheKey = ({
  contractId,
  locale,
  updatedAt,
}: ContractOgRichMediaCacheKeyInput) =>
  `contract:${contractId}:${updatedAt.getTime()}:${locale}:renderer:${CONTRACT_OG_RENDERER_VERSION}`;

export const getContractOgCoverImageUrl = (mediaRefs: unknown) => {
  if (!Array.isArray(mediaRefs) || typeof mediaRefs[0] !== "string") {
    return null;
  }

  const value = mediaRefs[0].trim();

  try {
    const url = new URL(value);
    const isTelegramMediaHost = CONTRACT_MEDIA_HOST_SUFFIXES.some(
      (suffix) =>
        url.hostname === suffix || url.hostname.endsWith(`.${suffix}`),
    );

    return url.protocol === "https:" && isTelegramMediaHost ? value : null;
  } catch {
    return null;
  }
};
