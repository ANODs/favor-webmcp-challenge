const INVALID_ACTIVE_CONTRACT_AUTHOR_ID = "INVALID_ACTIVE_CONTRACT_AUTHOR_ID";

export type ActiveContractAuthorScope = {
  authorId: number;
  status: "active";
};

export function buildActiveContractAuthorScope(
  authorId: number,
): ActiveContractAuthorScope {
  if (!Number.isSafeInteger(authorId) || authorId <= 0) {
    throw new Error(INVALID_ACTIVE_CONTRACT_AUTHOR_ID);
  }

  return {
    authorId,
    status: "active",
  };
}

export function resolveActiveContractAuthorScope(
  rawAuthorId: string | null,
): ActiveContractAuthorScope | null {
  if (rawAuthorId === null) {
    return null;
  }

  const normalizedAuthorId = rawAuthorId.trim();

  if (!/^[1-9]\d*$/.test(normalizedAuthorId)) {
    throw new Error(INVALID_ACTIVE_CONTRACT_AUTHOR_ID);
  }

  return buildActiveContractAuthorScope(Number(normalizedAuthorId));
}
