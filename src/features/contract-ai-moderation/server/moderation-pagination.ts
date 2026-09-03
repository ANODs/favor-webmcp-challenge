import { Prisma } from "@prisma/client";

import { OPEN_DEAL_STATUSES } from "@/entities/deal";
import { prisma } from "@/shared/lib/prisma";

export type ContractModerationSort = "createdAt" | "price" | "deals";
export type ContractModerationSortOrder = "asc" | "desc";

export const CONTRACT_MODERATION_RATING_SCAN_SIZE = 24;

export type ContractModerationCandidate =
  | {
      kind: "createdAt";
      id: number;
      createdAt: Date;
    }
  | {
      kind: "price";
      id: number;
      createdAt: Date;
      basePrice: string | null;
    }
  | {
      kind: "deals-positive";
      id: number;
      openDealsCount: number;
    }
  | {
      kind: "deals-zero";
      id: number;
      createdAt: Date;
    };

type SerializedCursor =
  | {
      version: 1;
      sort: "createdAt";
      order: "asc";
      id: number;
      createdAt: string;
    }
  | {
      version: 1;
      sort: "price";
      order: ContractModerationSortOrder;
      id: number;
      createdAt: string;
      basePrice: string | null;
    }
  | {
      version: 1;
      sort: "deals";
      order: ContractModerationSortOrder;
      phase: "positive";
      id: number;
      openDealsCount: number;
    }
  | {
      version: 1;
      sort: "deals";
      order: ContractModerationSortOrder;
      phase: "zero";
      id: number;
      createdAt: string;
    };

type ParsedCursor =
  | Extract<SerializedCursor, { sort: "createdAt" }>
  | Extract<SerializedCursor, { sort: "price" }>
  | Extract<SerializedCursor, { sort: "deals" }>;

type ListCandidatesInput = {
  where: Prisma.ContractWhereInput;
  rawCursor: string | null;
  sort: ContractModerationSort;
  order: ContractModerationSortOrder;
  take: number;
};

const INVALID_CURSOR_MESSAGE = "INVALID_CONTRACT_MODERATION_CURSOR";
const MAX_CURSOR_LENGTH = 1_024;

export async function listContractModerationCandidates({
  where,
  rawCursor,
  sort,
  order,
  take,
}: ListCandidatesInput) {
  const cursor = parseContractModerationCursor(rawCursor, sort, order);
  const boundedTake = Math.max(1, Math.min(take, 100));

  const records = await prisma.$transaction(
    (tx) => sort === "deals"
      ? listDealSortedCandidates(
          tx,
          where,
          cursor,
          order,
          boundedTake + 1,
        )
      : listScalarSortedCandidates(
          tx,
          where,
          cursor,
          sort,
          order,
          boundedTake + 1,
        ),
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );

  return {
    candidates: records.slice(0, boundedTake),
    hasMore: records.length > boundedTake,
  };
}

export function encodeContractModerationCursor(
  candidate: ContractModerationCandidate,
  order: ContractModerationSortOrder,
) {
  let cursor: SerializedCursor;

  if (candidate.kind === "createdAt") {
    cursor = {
      version: 1,
      sort: "createdAt",
      order: "asc",
      id: candidate.id,
      createdAt: candidate.createdAt.toISOString(),
    };
  } else if (candidate.kind === "price") {
    cursor = {
      version: 1,
      sort: "price",
      order,
      id: candidate.id,
      createdAt: candidate.createdAt.toISOString(),
      basePrice: candidate.basePrice,
    };
  } else if (candidate.kind === "deals-positive") {
    cursor = {
      version: 1,
      sort: "deals",
      order,
      phase: "positive",
      id: candidate.id,
      openDealsCount: candidate.openDealsCount,
    };
  } else {
    cursor = {
      version: 1,
      sort: "deals",
      order,
      phase: "zero",
      id: candidate.id,
      createdAt: candidate.createdAt.toISOString(),
    };
  }

  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function paginateContractModerationResults<TItem extends { id: number }>(
  eligibleItems: TItem[],
  candidates: ContractModerationCandidate[],
  hasMoreCandidates: boolean,
  order: ContractModerationSortOrder,
  pageSize: number,
) {
  const items = eligibleItems.slice(0, pageSize);
  const lastItem = items.at(-1);
  let boundary: ContractModerationCandidate | undefined;

  if (items.length === pageSize && lastItem) {
    const boundaryIndex = candidates.findIndex(
      (candidate) => candidate.id === lastItem.id,
    );
    const hasCandidateAfterBoundary =
      boundaryIndex >= 0 &&
      (boundaryIndex < candidates.length - 1 || hasMoreCandidates);

    if (hasCandidateAfterBoundary) {
      boundary = candidates[boundaryIndex];
    }
  } else if (hasMoreCandidates) {
    boundary = candidates.at(-1);
  }

  return {
    items,
    nextCursor: boundary
      ? encodeContractModerationCursor(boundary, order)
      : null,
  };
}

async function listScalarSortedCandidates(
  tx: Prisma.TransactionClient,
  where: Prisma.ContractWhereInput,
  cursor: ParsedCursor | undefined,
  sort: Exclude<ContractModerationSort, "deals">,
  order: ContractModerationSortOrder,
  take: number,
): Promise<ContractModerationCandidate[]> {
  const cursorWhere = cursor
    ? sort === "price" && cursor.sort === "price"
      ? buildPriceCursorWhere(cursor)
      : cursor.sort === "createdAt"
        ? buildCreatedAtCursorWhere(cursor)
        : undefined
    : undefined;
  const records = await tx.contract.findMany({
    where: cursorWhere ? { AND: [where, cursorWhere] } : where,
    orderBy: sort === "price"
      ? [
          { basePrice: { sort: order, nulls: "last" } },
          { createdAt: "desc" },
          { id: "desc" },
        ]
      : [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      createdAt: true,
      basePrice: true,
    },
    take,
  });

  return records.map((record) =>
    sort === "price"
      ? {
          kind: "price" as const,
          id: record.id,
          createdAt: record.createdAt,
          basePrice: record.basePrice?.toString() ?? null,
        }
      : {
          kind: "createdAt" as const,
          id: record.id,
          createdAt: record.createdAt,
        },
  );
}

async function listDealSortedCandidates(
  tx: Prisma.TransactionClient,
  where: Prisma.ContractWhereInput,
  cursor: ParsedCursor | undefined,
  order: ContractModerationSortOrder,
  take: number,
) {
  const phases = order === "asc"
    ? (["zero", "positive"] as const)
    : (["positive", "zero"] as const);
  const cursorPhase = cursor?.sort === "deals" ? cursor.phase : undefined;
  const startIndex = cursorPhase ? phases.indexOf(cursorPhase) : 0;
  const candidates: ContractModerationCandidate[] = [];

  for (let index = Math.max(startIndex, 0); index < phases.length; index += 1) {
    const remaining = take - candidates.length;
    if (remaining <= 0) {
      break;
    }

    const phase = phases[index];
    const phaseCursor = phase === cursorPhase && cursor?.sort === "deals"
      ? cursor
      : undefined;
    const phaseCandidates = phase === "positive"
      ? await listPositiveDealCandidates(
          tx,
          where,
          phaseCursor?.phase === "positive" ? phaseCursor : undefined,
          order,
          remaining,
        )
      : await listZeroDealCandidates(
          tx,
          where,
          phaseCursor?.phase === "zero" ? phaseCursor : undefined,
          remaining,
        );

    candidates.push(...phaseCandidates);
  }

  return candidates;
}

async function listPositiveDealCandidates(
  tx: Prisma.TransactionClient,
  where: Prisma.ContractWhereInput,
  cursor: Extract<SerializedCursor, { sort: "deals"; phase: "positive" }> | undefined,
  order: ContractModerationSortOrder,
  take: number,
): Promise<ContractModerationCandidate[]> {
  const countBoundary = cursor
    ? order === "asc"
      ? { gt: cursor.openDealsCount }
      : { lt: cursor.openDealsCount }
    : undefined;
  const having: Prisma.DealScalarWhereWithAggregatesInput | undefined = cursor
    ? {
        OR: [
          { contractId: { _count: countBoundary } },
          {
            AND: [
              {
                contractId: {
                  _count: { equals: cursor.openDealsCount },
                },
              },
              { contractId: { gt: cursor.id } },
            ],
          },
        ],
      }
    : undefined;
  const groups = await tx.deal.groupBy({
    by: ["contractId"],
    where: {
      contractId: { not: null },
      status: { in: OPEN_DEAL_STATUSES },
      contract: { is: where },
    },
    orderBy: [
      { _count: { contractId: order } },
      { contractId: "asc" },
    ],
    having,
    _count: { contractId: true },
    take,
  });

  return groups.flatMap((group) =>
    group.contractId === null
      ? []
      : [{
          kind: "deals-positive" as const,
          id: group.contractId,
          openDealsCount: group._count.contractId,
        }],
  );
}

async function listZeroDealCandidates(
  tx: Prisma.TransactionClient,
  where: Prisma.ContractWhereInput,
  cursor: Extract<SerializedCursor, { sort: "deals"; phase: "zero" }> | undefined,
  take: number,
): Promise<ContractModerationCandidate[]> {
  const cursorWhere = cursor ? buildCreatedAtCursorWhere(cursor) : undefined;
  const records = await tx.contract.findMany({
    where: {
      AND: [
        where,
        { deals: { none: { status: { in: OPEN_DEAL_STATUSES } } } },
        ...(cursorWhere ? [cursorWhere] : []),
      ],
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, createdAt: true },
    take,
  });

  return records.map((record) => ({
    kind: "deals-zero" as const,
    id: record.id,
    createdAt: record.createdAt,
  }));
}

function buildCreatedAtCursorWhere(cursor: { id: number; createdAt: string }) {
  const createdAt = new Date(cursor.createdAt);

  return {
    OR: [
      { createdAt: { gt: createdAt } },
      { createdAt, id: { gt: cursor.id } },
    ],
  } satisfies Prisma.ContractWhereInput;
}

function buildPriceCursorWhere(
  cursor: Extract<SerializedCursor, { sort: "price" }>,
) {
  const createdAt = new Date(cursor.createdAt);
  const priceTie: Prisma.ContractWhereInput = {
    basePrice: cursor.basePrice,
    OR: [
      { createdAt: { lt: createdAt } },
      { createdAt, id: { lt: cursor.id } },
    ],
  };

  if (cursor.basePrice === null) {
    return priceTie;
  }

  return {
    OR: [
      {
        basePrice: cursor.order === "asc"
          ? { gt: cursor.basePrice }
          : { lt: cursor.basePrice },
      },
      priceTie,
      { basePrice: null },
    ],
  } satisfies Prisma.ContractWhereInput;
}

export function parseContractModerationCursor(
  rawCursor: string | null,
  expectedSort: ContractModerationSort,
  expectedOrder: ContractModerationSortOrder,
): ParsedCursor | undefined {
  if (!rawCursor) {
    return undefined;
  }

  if (rawCursor.length > MAX_CURSOR_LENGTH) {
    throw new Error(INVALID_CURSOR_MESSAGE);
  }

  try {
    if (!/^[A-Za-z0-9_-]+$/.test(rawCursor)) {
      throw new Error(INVALID_CURSOR_MESSAGE);
    }

    const decodedCursor = Buffer.from(rawCursor, "base64url");
    if (decodedCursor.toString("base64url") !== rawCursor) {
      throw new Error(INVALID_CURSOR_MESSAGE);
    }

    const parsed = JSON.parse(
      decodedCursor.toString("utf8"),
    ) as unknown;

    if (!isValidCursor(parsed, expectedSort, expectedOrder)) {
      throw new Error(INVALID_CURSOR_MESSAGE);
    }

    return parsed;
  } catch {
    throw new Error(INVALID_CURSOR_MESSAGE);
  }
}

function isValidCursor(
  value: unknown,
  expectedSort: ContractModerationSort,
  expectedOrder: ContractModerationSortOrder,
): value is ParsedCursor {
  if (!value || typeof value !== "object") {
    return false;
  }

  const cursor = value as Record<string, unknown>;
  if (
    cursor.version !== 1 ||
    cursor.sort !== expectedSort ||
    cursor.order !== (expectedSort === "createdAt" ? "asc" : expectedOrder) ||
    !Number.isSafeInteger(cursor.id) ||
    Number(cursor.id) <= 0
  ) {
    return false;
  }

  if (cursor.sort === "createdAt") {
    return isValidDate(cursor.createdAt);
  }

  if (cursor.sort === "price") {
    return (
      isValidDate(cursor.createdAt) &&
      (cursor.basePrice === null ||
        (typeof cursor.basePrice === "string" &&
          /^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(cursor.basePrice)))
    );
  }

  if (cursor.sort === "deals" && cursor.phase === "positive") {
    return (
      Number.isSafeInteger(cursor.openDealsCount) &&
      Number(cursor.openDealsCount) > 0
    );
  }

  return cursor.sort === "deals" &&
    cursor.phase === "zero" &&
    isValidDate(cursor.createdAt);
}

function isValidDate(value: unknown) {
  if (typeof value !== "string") {
    return false;
  }

  const parsedDate = new Date(value);
  return !Number.isNaN(parsedDate.getTime()) &&
    parsedDate.toISOString() === value;
}
