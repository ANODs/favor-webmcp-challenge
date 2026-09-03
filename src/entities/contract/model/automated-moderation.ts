import { Profanease, type Severity } from "profanease";
import allLanguages from "profanease/langs/all";

export type ContractModerationField = "title" | "description" | "category" | "tagsInput";

type ContractModerationInput = Partial<Record<ContractModerationField, string | null | undefined>>;

export type ContractModerationMessages = {
  fieldLabels: Record<ContractModerationField, string>;
  fieldError: string;
  formatSummary: (fields: string[]) => string;
};

export type ContractModerationHit = {
  field: ContractModerationField;
  label: string;
  matches: string[];
  cleaned: string;
  severity: Severity;
};

export type ContractModerationResult = {
  isBlocked: boolean;
  summary: string;
  fieldErrors: Partial<Record<ContractModerationField, string>>;
  hits: ContractModerationHit[];
};

export const isContractModerationField = (
  field: string,
): field is ContractModerationField =>
  FIELD_CONFIG.some((item) => item === field);

const filter = new Profanease({
  languages: [allLanguages],
  normalize: "aggressive",
});

const FIELD_CONFIG: ContractModerationField[] = [
  "title",
  "description",
  "category",
  "tagsInput",
];

const DEFAULT_MESSAGES: ContractModerationMessages = {
  fieldLabels: {
    title: "Title",
    description: "Description",
    category: "Category",
    tagsInput: "Tags",
  },
  fieldError: "Automated moderation found prohibited words. Revise the text before submitting.",
  formatSummary: (fields) =>
    `Automated moderation found prohibited words in: ${fields.join(", ")}.`,
};

export function moderateContractContent(
  input: ContractModerationInput,
  messages: ContractModerationMessages = DEFAULT_MESSAGES,
): ContractModerationResult {
  const hits = FIELD_CONFIG.flatMap((field) => {
    const rawValue = input[field]?.trim();

    if (!rawValue) {
      return [];
    }

    const result = filter.analyze(rawValue);

    if (!result.isProfane) {
      return [];
    }

    return [
      {
        field,
        label: messages.fieldLabels[field],
        matches: Array.from(
          new Set(
            result.matches
              .map((match) => match.original.trim().toLowerCase())
              .filter(Boolean),
          ),
        ).slice(0, 5),
        cleaned: result.cleaned,
        severity: result.severity,
      } satisfies ContractModerationHit,
    ];
  });

  if (hits.length === 0) {
    return {
      isBlocked: false,
      summary: "",
      fieldErrors: {},
      hits: [],
    };
  }

  const fieldErrors = Object.fromEntries(
    hits.map((hit) => [hit.field, messages.fieldError]),
  ) as ContractModerationResult["fieldErrors"];

  const labels = Array.from(new Set(hits.map((hit) => hit.label)));

  return {
    isBlocked: true,
    summary: messages.formatSummary(labels),
    fieldErrors,
    hits,
  };
}
