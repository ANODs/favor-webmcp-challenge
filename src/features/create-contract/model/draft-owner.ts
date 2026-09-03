export type CreateContractDraftOwnerId = number | null | undefined;

export type CreateContractDraftOwnerTransition =
  | {
      kind: "keep";
      ownerId: CreateContractDraftOwnerId;
    }
  | {
      kind: "select";
      ownerId: number | null;
    }
  | {
      kind: "claim_anonymous";
      ownerId: number;
      fallbackOwnerId: null;
    };

export const planCreateContractDraftOwnerTransition = (
  currentOwnerId: CreateContractDraftOwnerId,
  resolvedOwnerId: CreateContractDraftOwnerId,
): CreateContractDraftOwnerTransition => {
  if (resolvedOwnerId === undefined) {
    return { kind: "keep", ownerId: currentOwnerId };
  }

  if (currentOwnerId === undefined) {
    return resolvedOwnerId === null
      ? { kind: "select", ownerId: null }
      : {
          kind: "claim_anonymous",
          ownerId: resolvedOwnerId,
          fallbackOwnerId: null,
        };
  }

  if (currentOwnerId === null) {
    return resolvedOwnerId === null
      ? { kind: "keep", ownerId: null }
      : {
          kind: "claim_anonymous",
          ownerId: resolvedOwnerId,
          fallbackOwnerId: null,
        };
  }

  if (resolvedOwnerId === null || resolvedOwnerId === currentOwnerId) {
    return { kind: "keep", ownerId: currentOwnerId };
  }

  return { kind: "select", ownerId: resolvedOwnerId };
};
