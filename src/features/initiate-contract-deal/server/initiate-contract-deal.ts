import {
  ContractStatus,
  ContractType,
  DealStatus,
  EscrowCurrency,
  Prisma,
  type Deal,
} from "@prisma/client";

import { ApplicationError } from "@/shared/lib/application-error";
import type { DealBriefResource } from "@/entities/deal";

const MAX_SERIALIZABLE_TRANSACTION_ATTEMPTS = 3;

const contractStatusNotificationSelect = {
  id: true,
  slug: true,
  titleRu: true,
  titleEn: true,
  status: true,
  author: { select: { id: true, telegramId: true } },
  scout: { select: { id: true, telegramId: true } },
} as const satisfies Prisma.ContractSelect;

type ContractStatusNotificationData = Prisma.ContractGetPayload<{
  select: typeof contractStatusNotificationSelect;
}>;

type ScoutOwnership = {
  authorId: number;
  scoutId: number | null;
};

export type InitiateContractDealPayload = {
  details: string;
  price?: number;
  deadlineDays?: number;
  isEscrow?: boolean;
  briefResources?: DealBriefResource[];
};

export type InitiateContractDealInput = {
  slug: string;
  userId: number;
  payload: InitiateContractDealPayload;
  expectedAuthorId: number;
};

export type InitiateContractDealResult =
  | {
      kind: "created";
      deal: Deal;
      contractSlug: string;
      updatedContract: ContractStatusNotificationData | null;
    }
  | {
      kind: "capacity_reached";
      contractSlug: string;
      updatedContract: ContractStatusNotificationData;
    };

export type InitiateContractDealTransactionRunner = <Result>(
  operation: (tx: Prisma.TransactionClient) => Promise<Result>,
) => Promise<Result>;

export type InitiateContractDealDependencies = {
  runSerializableTransaction: InitiateContractDealTransactionRunner;
  isRetryableWriteConflict: (error: unknown) => boolean;
  isUnclaimedScoutContract: (contract: ScoutOwnership) => boolean;
  openDealStatuses: DealStatus[];
  now: () => Date;
};

const initiateContractDealTransaction = async (
  tx: Prisma.TransactionClient,
  { slug, userId, payload, expectedAuthorId }: InitiateContractDealInput,
  dependencies: InitiateContractDealDependencies,
): Promise<InitiateContractDealResult> => {
  const contract = await tx.contract.findUnique({
    where: { slug },
  });

  if (!contract) {
    throw new Error("CONTRACT_NOT_FOUND");
  }

  if (contract.authorId !== expectedAuthorId) {
    throw new ApplicationError(
      "CONTRACT_AUTHOR_CHANGED",
      "The contract author changed. Submit the response again.",
      409,
    );
  }

  if (dependencies.isUnclaimedScoutContract(contract)) {
    throw new Error("CONTRACT_AUTHOR_CONFIRMATION_REQUIRED");
  }

  if (contract.status !== ContractStatus.active) {
    throw new Error("CONTRACT_DEAL_UNAVAILABLE");
  }

  if (contract.authorId === userId) {
    throw new Error("OWN_CONTRACT_DEAL_FORBIDDEN");
  }

  const existingUserDeal = await tx.deal.findFirst({
    where: {
      contractId: contract.id,
      status: { in: dependencies.openDealStatuses },
      OR: [{ customerId: userId }, { freelancerId: userId }],
    },
    select: { id: true },
  });

  if (existingUserDeal) {
    throw new Error("OPEN_DEAL_ALREADY_EXISTS");
  }

  const openDealsCount = await tx.deal.count({
    where: {
      contractId: contract.id,
      status: { in: dependencies.openDealStatuses },
    },
  });

  if (
    contract.maxOpenDeals !== null &&
    openDealsCount >= contract.maxOpenDeals
  ) {
    const updatedContract = await tx.contract.update({
      where: { id: contract.id },
      data: { status: ContractStatus.limit_reached },
      select: contractStatusNotificationSelect,
    });

    return {
      kind: "capacity_reached",
      contractSlug: contract.slug,
      updatedContract,
    };
  }

  const dealIsEscrow = contract.isEscrow ?? false;
  const dealDeadlineDays = payload.deadlineDays ?? contract.deadlineDays;
  const dealPrice = payload.price ?? contract.basePrice;

  if (dealIsEscrow && !dealDeadlineDays) {
    throw new Error("ESCROW_DEADLINE_REQUIRED");
  }
  if (dealPrice === null) {
    throw new Error("DEAL_PRICE_REQUIRED");
  }
  if (dealIsEscrow && Number(dealPrice) <= 0) {
    throw new Error("ESCROW_PRICE_MUST_BE_POSITIVE");
  }

  if (
    dealIsEscrow &&
    contract.escrowCurrency !== EscrowCurrency.TON &&
    contract.escrowCurrency !== EscrowCurrency.USDT
  ) {
    throw new Error("ESCROW_CURRENCY_UNSUPPORTED");
  }

  const paymentWindowHours = contract.paymentWindowHours ?? 24;
  const deal = await tx.deal.create({
    data: {
      contractId: contract.id,
      customerId:
        contract.type === ContractType.offer ? userId : contract.authorId,
      freelancerId:
        contract.type === ContractType.offer ? contract.authorId : userId,
      details:
        payload.details,
      price: dealPrice,
      deadlineDays: dealDeadlineDays,
      briefResources: payload.briefResources ?? [],
      paymentWindowHours,
      paymentExpiresAt: new Date(
        dependencies.now().getTime() + paymentWindowHours * 60 * 60 * 1000,
      ),
      status: DealStatus.pending_approval,
      isEscrow: dealIsEscrow,
      escrowCurrency: dealIsEscrow
        ? contract.escrowCurrency
        : EscrowCurrency.TON,
      contractSnapshot: {
        title: contract.titleRu || contract.titleEn || "",
        type: contract.type,
        slug: contract.slug,
        mediaRefs: contract.mediaRefs,
        escrowCurrency: contract.escrowCurrency,
      },
    },
  });

  await tx.communication.create({
    data: {
      dealId: deal.id,
      customerId: deal.customerId,
      freelancerId: deal.freelancerId,
    },
  });

  const reachesCapacity =
    contract.maxOpenDeals !== null &&
    openDealsCount + 1 >= contract.maxOpenDeals;
  const updatedContract = reachesCapacity
    ? await tx.contract.update({
        where: { id: contract.id },
        data: { status: ContractStatus.limit_reached },
        select: contractStatusNotificationSelect,
      })
    : null;

  return {
    kind: "created",
    deal,
    contractSlug: contract.slug,
    updatedContract,
  };
};

export async function initiateContractDealWithDependencies(
  input: InitiateContractDealInput,
  dependencies: InitiateContractDealDependencies,
): Promise<InitiateContractDealResult> {
  for (
    let attempt = 1;
    attempt <= MAX_SERIALIZABLE_TRANSACTION_ATTEMPTS;
    attempt += 1
  ) {
    try {
      return await dependencies.runSerializableTransaction((tx) =>
        initiateContractDealTransaction(tx, input, dependencies),
      );
    } catch (error) {
      const shouldRetry =
        attempt < MAX_SERIALIZABLE_TRANSACTION_ATTEMPTS &&
        dependencies.isRetryableWriteConflict(error);

      if (!shouldRetry) {
        throw error;
      }
    }
  }

  throw new Error("DEAL_CREATE_RETRY_EXHAUSTED");
}
