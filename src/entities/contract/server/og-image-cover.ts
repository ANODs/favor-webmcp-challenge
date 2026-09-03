import { proxyFetch } from "@/shared/lib/telegram/server";

import {
  CONTRACT_OG_COVER_STATE,
  getContractOgCoverImageUrl,
} from "../model/og-image";

const CONTRACT_OG_COVER_TIMEOUT_MS = 10_000;
const CONTRACT_OG_COVER_MAX_ATTEMPTS = 2;
const CONTRACT_OG_COVER_MAX_BYTES = 8 * 1024 * 1024;
const CONTRACT_OG_COVER_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

type ContractOgCoverFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

type ContractOgCoverLoadFailureReason =
  | "body_too_large"
  | "body_unavailable"
  | "declared_too_large"
  | "empty_image"
  | "http_error"
  | "invalid_image_signature"
  | "network_error"
  | "unsupported_content_type";

type ContractOgCoverLoadResult =
  | {
      state: typeof CONTRACT_OG_COVER_STATE.none;
      dataUrl: null;
      imageHost: null;
    }
  | {
      state: typeof CONTRACT_OG_COVER_STATE.embedded;
      dataUrl: string;
      imageHost: string;
    }
  | {
      state: typeof CONTRACT_OG_COVER_STATE.unavailable;
      dataUrl: null;
      imageHost: string;
      reason: ContractOgCoverLoadFailureReason;
      contentType?: string | null;
      errorMessage?: string;
      errorName?: string;
      responseStatus?: number;
    };

const matchesImageSignature = (bytes: Uint8Array, contentType: string) => {
  if (contentType === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }

  if (contentType === "image/png") {
    return (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    );
  }

  return (
    contentType === "image/webp" &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  );
};

const isRetryableHttpStatus = (status: number) =>
  status === 408 ||
  status === 425 ||
  status === 429 ||
  (status >= 500 && status <= 599);

const getNetworkFailureDetails = (error: unknown) => ({
  errorMessage: error instanceof Error ? error.message : String(error),
  errorName: error instanceof Error ? error.name : undefined,
});

const readBoundedBody = async (response: Response) => {
  if (!response.body) {
    return { bytes: null, exceededLimit: false } as const;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      byteLength += value.byteLength;

      if (byteLength > CONTRACT_OG_COVER_MAX_BYTES) {
        await reader.cancel();
        return { bytes: null, exceededLimit: true } as const;
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(byteLength);
  let offset = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return { bytes, exceededLimit: false } as const;
};

const unavailableResult = (
  imageHost: string,
  reason: ContractOgCoverLoadFailureReason,
  details: Omit<
    Extract<
      ContractOgCoverLoadResult,
      { state: typeof CONTRACT_OG_COVER_STATE.unavailable }
    >,
    "dataUrl" | "imageHost" | "reason" | "state"
  > = {},
): ContractOgCoverLoadResult => ({
  state: CONTRACT_OG_COVER_STATE.unavailable,
  dataUrl: null,
  imageHost,
  reason,
  ...details,
});

export const loadContractOgCoverImage = async (
  mediaRefs: unknown,
  fetchImage: ContractOgCoverFetch = proxyFetch,
): Promise<ContractOgCoverLoadResult> => {
  const imageUrl = getContractOgCoverImageUrl(mediaRefs);

  if (!imageUrl) {
    return {
      state: CONTRACT_OG_COVER_STATE.none,
      dataUrl: null,
      imageHost: null,
    };
  }

  const imageHost = new URL(imageUrl).hostname;
  const deadline = Date.now() + CONTRACT_OG_COVER_TIMEOUT_MS;
  let response: Response | null = null;
  let lastFetchError: unknown;

  for (let attempt = 0; attempt < CONTRACT_OG_COVER_MAX_ATTEMPTS; attempt += 1) {
    const remainingTime = deadline - Date.now();

    if (remainingTime <= 0) {
      break;
    }

    try {
      const candidate = await fetchImage(imageUrl, {
        cache: "no-store",
        headers: {
          Accept: "image/webp,image/png,image/jpeg",
          "User-Agent":
            "Mozilla/5.0 (compatible; FavorDealsBot/1.0; +https://favor.deals)",
        },
        redirect: "error",
        signal: AbortSignal.timeout(remainingTime),
      });

      if (candidate.ok) {
        response = candidate;
        break;
      }

      const canRetry =
        attempt + 1 < CONTRACT_OG_COVER_MAX_ATTEMPTS &&
        isRetryableHttpStatus(candidate.status);

      if (canRetry) {
        if (candidate.body) {
          await candidate.body.cancel().catch(() => undefined);
        }

        continue;
      }

      return unavailableResult(imageHost, "http_error", {
        responseStatus: candidate.status,
      });
    } catch (error) {
      lastFetchError = error;

      if (attempt + 1 >= CONTRACT_OG_COVER_MAX_ATTEMPTS) {
        return unavailableResult(
          imageHost,
          "network_error",
          getNetworkFailureDetails(error),
        );
      }
    }
  }

  if (!response) {
    return unavailableResult(
      imageHost,
      "network_error",
      getNetworkFailureDetails(
        lastFetchError ?? new Error("Contract OG cover request timed out"),
      ),
    );
  }

  try {
    const contentType = response.headers
      .get("content-type")
      ?.split(";", 1)[0]
      .trim()
      .toLowerCase();
    const contentLengthHeader = response.headers.get("content-length");
    const declaredLength = contentLengthHeader === null
      ? null
      : Number(contentLengthHeader);

    if (!contentType || !CONTRACT_OG_COVER_CONTENT_TYPES.has(contentType)) {
      return unavailableResult(imageHost, "unsupported_content_type", {
        contentType: contentType ?? null,
      });
    }

    if (
      declaredLength !== null &&
      Number.isFinite(declaredLength) &&
      declaredLength > CONTRACT_OG_COVER_MAX_BYTES
    ) {
      return unavailableResult(imageHost, "declared_too_large", {
        contentType,
      });
    }

    const { bytes, exceededLimit } = await readBoundedBody(response);

    if (exceededLimit) {
      return unavailableResult(imageHost, "body_too_large", { contentType });
    }

    if (!bytes) {
      return unavailableResult(imageHost, "body_unavailable", { contentType });
    }

    if (bytes.byteLength === 0) {
      return unavailableResult(imageHost, "empty_image", { contentType });
    }

    if (!matchesImageSignature(bytes, contentType)) {
      return unavailableResult(imageHost, "invalid_image_signature", {
        contentType,
      });
    }

    return {
      state: CONTRACT_OG_COVER_STATE.embedded,
      dataUrl: `data:${contentType};base64,${Buffer.from(bytes).toString("base64")}`,
      imageHost,
    };
  } catch (error) {
    return unavailableResult(imageHost, "network_error", {
      ...getNetworkFailureDetails(error),
    });
  }
};
