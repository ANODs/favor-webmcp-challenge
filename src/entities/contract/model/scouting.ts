import { ContractStatus } from "@prisma/client";

type ScoutOwnership = {
  authorId: number;
  scoutId?: number | null;
};

type ContractQuestionAvailability = ScoutOwnership & {
  status: ContractStatus;
};

type ContractManager = {
  id: number;
  role?: string | null;
};

type ContractContactViewer = ContractManager & {
  isPremium?: boolean | null;
};

export const buildContractManagementWriteWhere = (
  contractId: number,
  user: ContractManager,
) => ({
  id: contractId,
  ...(user.role === "moderator" ? {} : { authorId: user.id }),
});

export const canManageContract = (
  contract: Pick<ScoutOwnership, "authorId"> | null | undefined,
  user: ContractManager | null | undefined,
) =>
  contract != null &&
  user != null &&
  (contract.authorId === user.id || user.role === "moderator");

export const canViewContractAuthorContact = (
  contract: Pick<ScoutOwnership, "authorId"> | null | undefined,
  user: ContractContactViewer | null | undefined,
  hasRevealed = false,
) =>
  user != null &&
  (canManageContract(contract, user) ||
    user.isPremium === true ||
    hasRevealed);

export const isUnclaimedScoutContract = ({
  authorId,
  scoutId,
}: ScoutOwnership) => scoutId != null && authorId === scoutId;

export const isClaimedScoutContract = ({
  authorId,
  scoutId,
}: ScoutOwnership) => scoutId != null && authorId !== scoutId;

export const areContractQuestionsEnabled = (
  contract: ContractQuestionAvailability,
) =>
  contract.status === ContractStatus.active &&
  !isUnclaimedScoutContract(contract);
