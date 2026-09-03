import { z } from "zod";

import { env } from "@/shared/config/env";

const responseSchema = z.object({
  shortDescription: z.string().trim().min(1).max(500).catch(""),
  riskFactor: z.coerce.number().int().min(1).max(10).catch(0),
});

type ContractAiValidationPayload = {
  title: string;
  description: string;
  category?: string | null;
  tags?: string[];
  type: "offer" | "order";
  cachedTelegramText?: string | null;
};

export type ContractAiModerationResult = {
  shortDescription: string;
  riskFactor: number;
} | null;

export async function validateContractWithAi(
  payload: ContractAiValidationPayload,
): Promise<ContractAiModerationResult> {
  try {
    const response = await fetch(env.contractAiValidationUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: buildContractAiContent(payload),
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return null;
    }

    const parsed = responseSchema.safeParse(await response.json());

    if (!parsed.success) {
      return null;
    }

    const shortDescription = parsed.data.shortDescription.trim();
    const riskFactor = parsed.data.riskFactor;

    if (!shortDescription || riskFactor < 1 || riskFactor > 10) {
      return null;
    }

    return {
      shortDescription,
      riskFactor,
    };
  } catch {
    return null;
  }
}

function buildContractAiContent(payload: ContractAiValidationPayload) {
  const parts = [
    `Type: ${payload.type === "offer" ? "Service offer" : "Service request"}`,
    `Title: ${payload.title.trim()}`,
    payload.category?.trim() ? `Category: ${payload.category.trim()}` : null,
    payload.tags?.length ? `Tags: ${payload.tags.join(", ")}` : null,
    `Description: ${payload.description.trim()}`,
    payload.cachedTelegramText?.trim()
      ? `Telegram source text: ${payload.cachedTelegramText.trim()}`
      : null,
  ];

  return parts.filter(Boolean).join("\n\n");
}

export {
  CONTRACT_MODERATION_RATING_SCAN_SIZE,
  encodeContractModerationCursor,
  listContractModerationCandidates,
  paginateContractModerationResults,
  parseContractModerationCursor,
  type ContractModerationCandidate,
  type ContractModerationSort,
  type ContractModerationSortOrder,
} from "./server/moderation-pagination";
export { CONTRACT_MODERATION_QUEUE_FILTER } from "./model/moderation-filter";
