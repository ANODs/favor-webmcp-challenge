import classifierData from "./classifier.data.json";
import {
  CATEGORY_CATALOG,
  getCategoryAliases,
  normalizeCategoryAlias,
  type CategoryId,
} from "./catalog";

export type ContractCategoryClassifierInput = Readonly<{
  titleRu?: string | null;
  titleEn?: string | null;
  descriptionRu?: string | null;
  descriptionEn?: string | null;
  tags?: readonly string[] | string | null;
}>;

export type ContractCategoryClassification = Readonly<{
  categoryId: CategoryId;
  confidence: "high" | "medium" | "low";
  score: number;
  evidence: string[];
}>;

type ContextSignal = Readonly<{
  term: string;
  weight: number;
}>;

const CONTEXT_SIGNALS: Partial<Record<CategoryId, readonly ContextSignal[]>> =
  classifierData.contextSignals;

const NON_PERFORMANCE_MODEL_CONTEXT: readonly string[] =
  classifierData.nonPerformanceModelContext;

const PERFORMANCE_MODEL_ALIASES: readonly string[] =
  classifierData.performanceModelAliases;

type SourceField = Readonly<{
  name: "titleRu" | "titleEn" | "descriptionRu" | "descriptionEn" | "tags";
  value: string;
  multiplier: number;
}>;

const containsTerm = (text: string, term: string) => {
  if (!term) return false;
  const textTokens = text.split(" ");
  const termTokens = term.split(" ");
  if (termTokens.length > textTokens.length) return false;

  return textTokens.some((_, startIndex) =>
    termTokens.every((termToken, offset) => {
      const textToken = textTokens[startIndex + offset];
      if (!textToken) return false;
      return termToken.length <= 3
        ? textToken === termToken
        : textToken.startsWith(termToken);
    }),
  );
};

const isContextuallyBlockedAlias = (
  categoryId: CategoryId,
  alias: string,
  text: string,
) =>
  categoryId === "media.performance" &&
  PERFORMANCE_MODEL_ALIASES.includes(alias) &&
  NON_PERFORMANCE_MODEL_CONTEXT.some((term) => containsTerm(text, term));

const roundScore = (value: number) => Math.round(value * 100) / 100;

function sourceFields(input: ContractCategoryClassifierInput): SourceField[] {
  const tags = Array.isArray(input.tags) ? input.tags.join(" ") : input.tags;
  const candidates = [
    ["titleRu", input.titleRu, 3],
    ["titleEn", input.titleEn, 3],
    ["descriptionRu", input.descriptionRu, 1],
    ["descriptionEn", input.descriptionEn, 1],
    ["tags", tags, 2],
  ] as const;

  return candidates.flatMap(([name, value, multiplier]) => {
    if (typeof value !== "string") return [];
    const normalized = normalizeCategoryAlias(value);
    return normalized ? [{ name, value: normalized, multiplier }] : [];
  });
}

export function classifyContractCategory(
  input: ContractCategoryClassifierInput,
): ContractCategoryClassification {
  const fields = sourceFields(input);
  const results: Array<{
    categoryId: CategoryId;
    score: number;
    evidence: string[];
  }> = [];

  for (const entry of CATEGORY_CATALOG) {
    if (entry.id === "other.manual") continue;

    let score = 0;
    const evidence: string[] = [];
    const aliases = new Set(
      getCategoryAliases(entry.id)
        .filter((alias) => alias !== entry.id)
        .map(normalizeCategoryAlias)
        .filter(Boolean),
    );

    for (const field of fields) {
      for (const alias of aliases) {
        if (isContextuallyBlockedAlias(entry.id, alias, field.value)) continue;
        if (!containsTerm(field.value, alias)) continue;
        const exact = field.value === alias;
        const aliasWeight = exact ? 8 : alias.includes(" ") ? 3 : 2;
        const contribution = aliasWeight * field.multiplier;
        score += contribution;
        if (evidence.length < 8) {
          evidence.push(
            `${field.name}:alias:${alias}:+${roundScore(contribution)}`,
          );
        }
      }

      for (const signal of CONTEXT_SIGNALS[entry.id] ?? []) {
        if (!containsTerm(field.value, signal.term)) continue;
        const contribution = signal.weight * field.multiplier;
        score += contribution;
        if (evidence.length < 8) {
          evidence.push(
            `${field.name}:signal:${signal.term}:+${roundScore(contribution)}`,
          );
        }
      }
    }

    if (score > 0) results.push({ categoryId: entry.id, score, evidence });
  }

  results.sort(
    (left, right) =>
      right.score - left.score ||
      left.categoryId.localeCompare(right.categoryId),
  );

  const best = results[0];
  if (!best) {
    return {
      categoryId: "other.manual",
      confidence: "low",
      score: 0,
      evidence: [],
    };
  }

  const runnerUpScore = results[1]?.score ?? 0;
  const margin = best.score - runnerUpScore;
  const confidence =
    best.score >= 14 && margin >= 3
      ? "high"
      : best.score >= 6 && margin >= 1
        ? "medium"
        : "low";

  return {
    categoryId: best.categoryId,
    confidence,
    score: roundScore(best.score),
    evidence: best.evidence,
  };
}
