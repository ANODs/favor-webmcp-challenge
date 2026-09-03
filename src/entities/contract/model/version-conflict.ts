export const CONTRACT_VERSION_CONFLICT_CODE = "CONTRACT_VERSION_CONFLICT";

export type ContractVersionConflictDetails = {
  contractId: number;
  slug: string;
  updatedAt: string;
};

type ContractVersion = {
  id: number;
  slug: string;
  updatedAt: Date | string;
};

const toUpdatedAtString = (updatedAt: Date | string) =>
  updatedAt instanceof Date ? updatedAt.toISOString() : updatedAt;

export const buildContractVersionConflictDetails = (
  contract: ContractVersion,
): ContractVersionConflictDetails => ({
  contractId: contract.id,
  slug: contract.slug,
  updatedAt: toUpdatedAtString(contract.updatedAt),
});

export const getContractVersionConflictDetails = (
  request: {
    contractId: number;
    slug: string;
    baseUpdatedAt: string;
  },
  currentContract: ContractVersion,
): ContractVersionConflictDetails | null => {
  const current = buildContractVersionConflictDetails(currentContract);

  return request.contractId === current.contractId &&
    request.slug === current.slug &&
    request.baseUpdatedAt === current.updatedAt
    ? null
    : current;
};

export const parseContractVersionConflictDetails = (
  value: unknown,
): ContractVersionConflictDetails | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const details = value as Record<string, unknown>;

  return Number.isInteger(details.contractId) &&
    (details.contractId as number) > 0 &&
    typeof details.slug === "string" &&
    details.slug.length > 0 &&
    typeof details.updatedAt === "string" &&
    !Number.isNaN(Date.parse(details.updatedAt))
    ? {
        contractId: details.contractId as number,
        slug: details.slug,
        updatedAt: details.updatedAt,
      }
    : null;
};
