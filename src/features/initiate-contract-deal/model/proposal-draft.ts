import {
  dealBriefResourcesSchema,
  type DealBriefResource,
} from "@/entities/deal";

export type DealBriefResourceDraft = {
  url: string;
  label: string;
};

export const getDealProposalValidation = ({
  details,
  price,
  deadlineDays,
  resources,
  isEscrow = false,
}: {
  details: string;
  price: string;
  deadlineDays: string;
  resources: DealBriefResourceDraft[];
  isEscrow?: boolean;
}) => {
  const normalizedResources = resources
    .filter((resource) => resource.url.trim() || resource.label.trim())
    .map((resource) => ({
      kind: "link" as const,
      url: resource.url.trim(),
      ...(resource.label.trim() ? { label: resource.label.trim() } : {}),
    }));
  const parsedResources = dealBriefResourcesSchema.safeParse(normalizedResources);
  const normalizedPrice = price.trim();
  const normalizedDeadline = deadlineDays.trim();
  const numericPrice = Number(normalizedPrice);
  const numericDeadline = Number(normalizedDeadline);
  const isDetailsValid = details.trim().length >= 5 && details.trim().length <= 3000;
  const isPriceValid =
    normalizedPrice !== "" &&
    Number.isFinite(numericPrice) &&
    (isEscrow ? numericPrice > 0 : numericPrice >= 0);
  const isDeadlineValid =
    normalizedDeadline !== "" &&
    Number.isInteger(numericDeadline) &&
    numericDeadline >= 1 &&
    numericDeadline <= 365;

  return {
    isDetailsValid,
    isPriceValid,
    isDeadlineValid,
    areResourcesValid: parsedResources.success,
    resources: parsedResources.success
      ? parsedResources.data
      : ([] as DealBriefResource[]),
    isValid:
      isDetailsValid &&
      isPriceValid &&
      isDeadlineValid &&
      parsedResources.success,
  };
};
