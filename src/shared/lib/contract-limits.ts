import { ContractStatus, type Prisma, Role } from "@prisma/client";

import { CONTRACT_ERROR_CODES } from "@/shared/config";
import { getContractLimits } from "@/shared/config/contract-limits";
import { ApplicationError } from "./application-error";
import { prisma } from "./prisma";

type ContractLimitClient = Pick<Prisma.TransactionClient, "contract">;

export const CONTRACT_LIMIT_ERROR_CODE = CONTRACT_ERROR_CODES.limitReached;

export type ContractLimitErrorDetails = {
  contractKind: "standard" | "scouted";
  current: number;
  limit: number;
  isPremium: boolean;
  upgradeLimit: number;
};

export type ContractLimitResult =
  | { allowed: true }
  | {
      allowed: false;
      error: string;
      code: typeof CONTRACT_LIMIT_ERROR_CODE;
      status: 400;
      details: ContractLimitErrorDetails;
    };

export const hasUnlimitedContractPublishing = (role: Role) =>
  role === Role.moderator;

export { getContractLimits };

const createContractLimitResult = ({
  count,
  isPremium,
  isScouting,
  limit,
  upgradeLimit,
}: {
  count: number;
  isPremium: boolean;
  isScouting: boolean;
  limit: number;
  upgradeLimit: number;
}): ContractLimitResult => {
  const contractKind = isScouting ? "scouted" : "standard";
  const planLabel = isPremium ? "Favor Plus" : "free";
  const upgradeHint = isPremium
    ? ""
    : ` Upgrade to Favor Plus to raise the limit to ${upgradeLimit}.`;
  const details: ContractLimitErrorDetails = {
    contractKind,
    current: count,
    limit,
    isPremium,
    upgradeLimit,
  };
  const error = new ApplicationError(
    CONTRACT_LIMIT_ERROR_CODE,
    `${planLabel} active ${contractKind} contract limit reached (maximum ${limit} at a time).${upgradeHint}`,
    400,
    details,
  );

  return {
    allowed: false,
    error: error.message,
    code: CONTRACT_LIMIT_ERROR_CODE,
    status: 400,
    details,
  };
};

export async function checkContractLimitWithClient(
  database: ContractLimitClient,
  userId: number,
  isPremium: boolean,
  isScouting: boolean,
  role: Role,
): Promise<ContractLimitResult> {
  if (hasUnlimitedContractPublishing(role)) {
    return { allowed: true };
  }

  const limits = getContractLimits(isPremium);

  if (isScouting) {
    const count = await database.contract.count({
      where: {
        scoutId: userId,
        authorId: userId,
        status: {
          notIn: [ContractStatus.archived, ContractStatus.rejected],
        },
      },
    });

    if (count >= limits.maxScoutedContracts) {
      return createContractLimitResult({
        count,
        isPremium,
        isScouting,
        limit: limits.maxScoutedContracts,
        upgradeLimit: getContractLimits(true).maxScoutedContracts,
      });
    }
  } else {
    const count = await database.contract.count({
      where: {
        authorId: userId,
        OR: [
          { scoutId: null },
          {
            scoutId: {
              not: userId,
            },
          },
        ],
        status: {
          notIn: [ContractStatus.archived, ContractStatus.rejected],
        },
      },
    });

    if (count >= limits.maxNormalContracts) {
      return createContractLimitResult({
        count,
        isPremium,
        isScouting,
        limit: limits.maxNormalContracts,
        upgradeLimit: getContractLimits(true).maxNormalContracts,
      });
    }
  }

  return { allowed: true };
}

export function checkContractLimit(
  userId: number,
  isPremium: boolean,
  isScouting: boolean,
  role: Role,
): Promise<ContractLimitResult> {
  return checkContractLimitWithClient(
    prisma,
    userId,
    isPremium,
    isScouting,
    role,
  );
}
