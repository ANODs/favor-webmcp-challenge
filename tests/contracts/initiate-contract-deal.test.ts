import assert from "node:assert/strict";
import test from "node:test";
import {
  ContractStatus,
  ContractType,
  DealStatus,
  EscrowCurrency,
  Prisma,
  type Contract,
  type Deal,
} from "@prisma/client";

import {
  initiateContractDealWithDependencies,
  type InitiateContractDealDependencies,
  type InitiateContractDealTransactionRunner,
} from "../../src/features/initiate-contract-deal/server/initiate-contract-deal";
import { ApplicationError } from "../../src/shared/lib/application-error";

type FixtureOptions = {
  contractExists?: boolean;
  type?: ContractType;
  status?: ContractStatus;
  authorId?: number;
  scoutId?: number | null;
  maxOpenDeals?: number | null;
  openDealsCount?: number;
  existingDeal?: boolean;
  retryableFailures?: number;
};

type MutationCaptures = {
  transactionAttempts: number;
  dealCreates: Array<Record<string, unknown>>;
  communicationCreates: Array<Record<string, unknown>>;
  contractStatuses: ContractStatus[];
};

const initiatedAt = new Date("2026-08-25T12:00:00.000Z");
const proposalDetails = "Сделаю адаптивный макет и передам исходники.";

const makeContract = (options: FixtureOptions): Contract =>
  ({
    id: 41,
    authorId: options.authorId ?? 10,
    titleRu: "Тестовый контракт",
    titleEn: "Test contract",
    slug: "test-contract",
    descriptionRu: "Условия тестового контракта",
    descriptionEn: null,
    type: options.type ?? ContractType.offer,
    category: "development",
    tags: [],
    basePrice: new Prisma.Decimal(125),
    deadlineDays: 7,
    paymentWindowHours: 24,
    maxOpenDeals: options.maxOpenDeals ?? null,
    status: options.status ?? ContractStatus.active,
    isEscrow: true,
    escrowCurrency: EscrowCurrency.TON,
    moderationComment: null,
    aiModerationSummary: null,
    aiRiskFactor: null,
    telegramPostUrl: null,
    telegramChannelUrl: null,
    cachedTelegramText: null,
    verificationCode: null,
    scoutedTelegramUsername: null,
    mediaRefs: null,
    contentFingerprint: null,
    ogImageBase64: null,
    scoutId: options.scoutId ?? null,
    createdAt: initiatedAt,
    updatedAt: initiatedAt,
  }) satisfies Contract;

const makeFixture = (options: FixtureOptions = {}) => {
  const contract = makeContract(options);
  const retryableConflict = new Error("serializable write conflict");
  const captures: MutationCaptures = {
    transactionAttempts: 0,
    dealCreates: [],
    communicationCreates: [],
    contractStatuses: [],
  };

  const tx = {
    contract: {
      findUnique: async () =>
        options.contractExists === false ? null : contract,
      update: async (args: unknown) => {
        const { data } = args as { data: { status: ContractStatus } };
        contract.status = data.status;
        captures.contractStatuses.push(data.status);

        return {
          id: contract.id,
          slug: contract.slug,
          titleRu: contract.titleRu,
          titleEn: contract.titleEn,
          status: contract.status,
          author: { id: contract.authorId, telegramId: 1000n },
          scout: contract.scoutId
            ? { id: contract.scoutId, telegramId: 2000n }
            : null,
        };
      },
    },
    deal: {
      findFirst: async () =>
        options.existingDeal ? { id: 91 } : null,
      count: async () => options.openDealsCount ?? 0,
      create: async (args: unknown) => {
        const { data } = args as { data: Record<string, unknown> };
        captures.dealCreates.push(data);

        return {
          id: 501,
          customerId: data.customerId,
          freelancerId: data.freelancerId,
          status: data.status,
        } as unknown as Deal;
      },
    },
    communication: {
      create: async (args: unknown) => {
        const { data } = args as { data: Record<string, unknown> };
        captures.communicationCreates.push(data);
        return { id: 601, ...data };
      },
    },
  } as unknown as Prisma.TransactionClient;

  const runSerializableTransaction: InitiateContractDealTransactionRunner =
    async (operation) => {
      captures.transactionAttempts += 1;
      if (
        captures.transactionAttempts <= (options.retryableFailures ?? 0)
      ) {
        throw retryableConflict;
      }
      return operation(tx);
    };

  const dependencies: InitiateContractDealDependencies = {
    runSerializableTransaction,
    isRetryableWriteConflict: (error) => error === retryableConflict,
    isUnclaimedScoutContract: ({ authorId, scoutId }) =>
      scoutId !== null && authorId === scoutId,
    openDealStatuses: [
      DealStatus.pending_approval,
      DealStatus.in_progress,
      DealStatus.in_dispute,
    ],
    now: () => initiatedAt,
  };

  return { captures, contract, dependencies };
};

const initiate = (
  dependencies: InitiateContractDealDependencies,
  expectedAuthorId = 10,
) =>
  initiateContractDealWithDependencies(
    {
      slug: "test-contract",
      userId: 20,
      payload: { details: proposalDetails },
      expectedAuthorId,
    },
    dependencies,
  );

test("offer creates a pending deal with the initiator as customer", async () => {
  const { captures, dependencies } = makeFixture({
    type: ContractType.offer,
  });

  const result = await initiate(dependencies);

  assert.equal(result.kind, "created");
  assert.equal(result.deal.customerId, 20);
  assert.equal(result.deal.freelancerId, 10);
  assert.equal(result.deal.status, DealStatus.pending_approval);
  assert.deepEqual(captures.communicationCreates, [
    { dealId: 501, customerId: 20, freelancerId: 10 },
  ]);
  const paymentExpiresAt = captures.dealCreates[0]?.paymentExpiresAt;
  assert.ok(paymentExpiresAt instanceof Date);
  assert.equal(
    paymentExpiresAt.toISOString(),
    "2026-08-26T12:00:00.000Z",
  );
});

test("order creates a pending deal with the initiator as freelancer", async () => {
  const { captures, dependencies } = makeFixture({
    type: ContractType.order,
  });

  const result = await initiate(dependencies);

  assert.equal(result.kind, "created");
  assert.equal(result.deal.customerId, 10);
  assert.equal(result.deal.freelancerId, 20);
  assert.equal(result.deal.status, DealStatus.pending_approval);
  assert.deepEqual(captures.communicationCreates, [
    { dealId: 501, customerId: 10, freelancerId: 20 },
  ]);
});

test("concrete terms and project materials are snapshotted with the deal", async () => {
  const { captures, dependencies } = makeFixture();
  const briefResources = [
    {
      kind: "link" as const,
      url: "https://www.figma.com/design/example",
      label: "Figma mockup",
    },
    {
      kind: "link" as const,
      url: "https://drive.google.com/drive/folders/example",
    },
  ];

  await initiateContractDealWithDependencies(
    {
      slug: "test-contract",
      userId: 20,
      payload: {
        details: "Подготовить desktop и mobile макеты.",
        price: 120,
        deadlineDays: 3,
        briefResources,
      },
      expectedAuthorId: 10,
    },
    dependencies,
  );

  assert.equal(
    captures.dealCreates[0]?.details,
    "Подготовить desktop и mobile макеты.",
  );
  assert.equal(captures.dealCreates[0]?.price, 120);
  assert.equal(captures.dealCreates[0]?.deadlineDays, 3);
  assert.deepEqual(captures.dealCreates[0]?.briefResources, briefResources);
});

test("duplicate open deal is rejected before any writes", async () => {
  const { captures, dependencies } = makeFixture({ existingDeal: true });

  await assert.rejects(
    initiate(dependencies),
    /OPEN_DEAL_ALREADY_EXISTS/,
  );
  assert.equal(captures.dealCreates.length, 0);
  assert.equal(captures.communicationCreates.length, 0);
  assert.equal(captures.contractStatuses.length, 0);
});

test("an author changed after Telegram preflight is rejected before writes", async () => {
  const { captures, dependencies } = makeFixture({ authorId: 11 });

  await assert.rejects(
    initiateContractDealWithDependencies(
      {
        slug: "test-contract",
        userId: 20,
        payload: { details: proposalDetails },
        expectedAuthorId: 10,
      },
      dependencies,
    ),
    (error: unknown) =>
      error instanceof ApplicationError &&
      error.code === "CONTRACT_AUTHOR_CHANGED" &&
      error.status === 409,
  );
  assert.equal(captures.dealCreates.length, 0);
  assert.equal(captures.communicationCreates.length, 0);
  assert.equal(captures.contractStatuses.length, 0);
});

test("full active contract is closed without creating another deal", async () => {
  const { captures, dependencies } = makeFixture({
    maxOpenDeals: 2,
    openDealsCount: 2,
  });

  const result = await initiate(dependencies);

  assert.equal(result.kind, "capacity_reached");
  assert.equal(result.updatedContract.status, ContractStatus.limit_reached);
  assert.equal(captures.dealCreates.length, 0);
  assert.deepEqual(captures.contractStatuses, [
    ContractStatus.limit_reached,
  ]);
});

test("deal taking the final slot and limit status are written together", async () => {
  const { captures, dependencies } = makeFixture({
    maxOpenDeals: 2,
    openDealsCount: 1,
  });

  const result = await initiate(dependencies);

  assert.equal(result.kind, "created");
  assert.equal(result.updatedContract?.status, ContractStatus.limit_reached);
  assert.equal(captures.dealCreates.length, 1);
  assert.equal(captures.communicationCreates.length, 1);
  assert.deepEqual(captures.contractStatuses, [
    ContractStatus.limit_reached,
  ]);
});

test("serializable write conflicts are retried within the fixed budget", async () => {
  const { captures, dependencies } = makeFixture({ retryableFailures: 2 });

  const result = await initiate(dependencies);

  assert.equal(result.kind, "created");
  assert.equal(captures.transactionAttempts, 3);
  assert.equal(captures.dealCreates.length, 1);
});

test("serializable write conflict is surfaced after three attempts", async () => {
  const { captures, dependencies } = makeFixture({ retryableFailures: 3 });

  await assert.rejects(initiate(dependencies), /serializable write conflict/);
  assert.equal(captures.transactionAttempts, 3);
  assert.equal(captures.dealCreates.length, 0);
});

test("inactive, unclaimed, and own contracts expose stable business error codes", async (t) => {
  await t.test("inactive", async () => {
    const { dependencies } = makeFixture({
      status: ContractStatus.archived,
    });
    await assert.rejects(
      initiate(dependencies),
      /CONTRACT_DEAL_UNAVAILABLE/,
    );
  });

  await t.test("unclaimed", async () => {
    const { dependencies } = makeFixture({ authorId: 10, scoutId: 10 });
    await assert.rejects(
      initiate(dependencies),
      /CONTRACT_AUTHOR_CONFIRMATION_REQUIRED/,
    );
  });

  await t.test("own", async () => {
    const { dependencies } = makeFixture({ authorId: 20 });
    await assert.rejects(
      initiate(dependencies, 20),
      /OWN_CONTRACT_DEAL_FORBIDDEN/,
    );
  });
});
