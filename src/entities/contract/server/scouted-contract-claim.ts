import { ContractStatus, type Prisma, Role } from "@prisma/client";

import {
  checkContractLimitWithClient,
  hasUnlimitedContractPublishing,
} from "@/shared/lib/contract-limits";

const CONTRACT_CLAIM_LIMIT_LOCK_NAMESPACE = 1_179_821_941;

type ClaimScoutedContractAuthorInput = {
  contractId: number;
  scoutId: number;
  claimantId: number;
  claimantIsPremium: boolean;
  claimantRole: Role;
};

export class ContractClaimConflictError extends Error {
  constructor() {
    super("The scouted contract is no longer claimable.");
    this.name = "ContractClaimConflictError";
  }
}

export class ContractClaimLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContractClaimLimitError";
  }
}

export async function claimScoutedContractAuthor(
  tx: Prisma.TransactionClient,
  {
    contractId,
    scoutId,
    claimantId,
    claimantIsPremium,
    claimantRole,
  }: ClaimScoutedContractAuthorInput,
) {
  if (!hasUnlimitedContractPublishing(claimantRole)) {
    await tx.$queryRaw`
      SELECT pg_advisory_xact_lock(
        ${CONTRACT_CLAIM_LIMIT_LOCK_NAMESPACE},
        ${claimantId}
      )::text AS "lock"
    `;

    const limitCheck = await checkContractLimitWithClient(
      tx,
      claimantId,
      claimantIsPremium,
      false,
      claimantRole,
    );
    if (!limitCheck.allowed) {
      throw new ContractClaimLimitError(
        limitCheck.error ?? "Contract claim limit reached.",
      );
    }
  }

  const claimed = await tx.contract.updateMany({
    where: {
      id: contractId,
      status: ContractStatus.active,
      authorId: scoutId,
      scoutId,
    },
    data: {
      authorId: claimantId,
    },
  });

  if (claimed.count !== 1) {
    throw new ContractClaimConflictError();
  }

  return tx.contract.findUniqueOrThrow({
    where: { id: contractId },
  });
}
