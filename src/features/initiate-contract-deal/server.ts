import { Prisma } from "@prisma/client";

import { isUnclaimedScoutContract } from "@/entities/contract";
import { OPEN_DEAL_STATUSES } from "@/entities/deal";
import { assertTelegramBotWriteAccess } from "@/entities/user/server";
import { prisma } from "@/shared/lib/prisma";
import {
  initiateContractDealWithDependencies,
  type InitiateContractDealInput,
  type InitiateContractDealTransactionRunner,
} from "./server/initiate-contract-deal";
import {
  initiateContractDealWithServerDependencies,
  type InitiateContractDealServerInput,
} from "./server/initiate-contract-deal-server";

export {
  initiateContractDealSchema,
  type InitiateContractDealPayload,
} from "./model/schema";

const runPrismaSerializableTransaction: InitiateContractDealTransactionRunner =
  (operation) =>
    prisma.$transaction(operation, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });

const initiateContractDealWithPersistence = (input: InitiateContractDealInput) =>
  initiateContractDealWithDependencies(input, {
    runSerializableTransaction: runPrismaSerializableTransaction,
    isRetryableWriteConflict: (error) =>
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034",
    isUnclaimedScoutContract,
    openDealStatuses: OPEN_DEAL_STATUSES,
    now: () => new Date(),
  });

export const initiateContractDeal = (input: InitiateContractDealServerInput) =>
  initiateContractDealWithServerDependencies(input, {
    findContractAuthorTelegramIdentity: async (slug) => {
      const contract = await prisma.contract.findUnique({
        where: { slug },
        select: {
          authorId: true,
          author: {
            select: {
              telegramId: true,
            },
          },
        },
      });

      return contract
        ? {
            userId: contract.authorId,
            telegramUserId: contract.author.telegramId,
          }
        : null;
    },
    assertTelegramBotWriteAccess,
    initiate: initiateContractDealWithPersistence,
  });
