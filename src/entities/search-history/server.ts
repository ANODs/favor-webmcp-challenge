import type { Prisma } from "@prisma/client";

import { prisma } from "@/shared/lib/prisma";
import { ApplicationError } from "@/shared/lib/application-error";

import {
  SEARCH_HISTORY_LIMIT,
  buildSearchHistoryItems,
  getEffectiveClientTimestamp,
  getSearchHistoryQueryKey,
  isSearchEventSuppressedByDeletion,
  type DeleteSearchHistoryInput,
  type RecordSearchEventInput,
  type SearchHistoryItem,
  type SearchHistoryRow,
  type SearchHistoryScope,
} from "./model/contracts";

type SaveSearchEventInput = {
  event: RecordSearchEventInput;
  userId: number;
};

const GLOBAL_SEARCH_HISTORY_QUERY_KEY = "";

const lockSearchHistoryOwner = async (
  transaction: Prisma.TransactionClient,
  userId: number,
) => {
  await transaction.$queryRaw<Array<{ id: number }>>`
    SELECT "id"
    FROM "User"
    WHERE "id" = ${userId}
    FOR UPDATE
  `;
};

const canonicalizeJson = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalizeJson).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(
        ([key, nestedValue]) =>
          `${JSON.stringify(key)}:${canonicalizeJson(nestedValue)}`,
      )
      .join(",")}}`;
  }

  return JSON.stringify(value) ?? "null";
};

export const saveSearchEvent = async ({
  event,
  userId,
}: SaveSearchEventInput) =>
  prisma.$transaction(async (transaction) => {
    await lockSearchHistoryOwner(transaction, userId);

    const queryKey = getSearchHistoryQueryKey(event.query);
    const clientSearchedAt = new Date(event.clientSearchedAt);
    const effectiveClientSearchedAt = getEffectiveClientTimestamp(
      clientSearchedAt,
      new Date(),
    );
    const existingEvent = await transaction.searchEvent.findUnique({
      where: { eventId: event.eventId },
      select: {
        eventId: true,
        userId: true,
        scope: true,
        query: true,
        queryKey: true,
        filters: true,
        trigger: true,
        locale: true,
        clientSearchedAt: true,
        historyDeletedAt: true,
        createdAt: true,
      },
    });

    if (existingEvent) {
      const matchesExistingEvent =
        existingEvent.userId === userId &&
        existingEvent.scope === event.scope &&
        existingEvent.query === event.query &&
        existingEvent.queryKey === queryKey &&
        canonicalizeJson(existingEvent.filters) ===
          canonicalizeJson(event.filters) &&
        existingEvent.trigger === event.trigger &&
        existingEvent.locale === (event.locale ?? null) &&
        existingEvent.clientSearchedAt.getTime() ===
          clientSearchedAt.getTime();

      if (!matchesExistingEvent) {
        throw new ApplicationError(
          "SEARCH_HISTORY_EVENT_CONFLICT",
          "Search history event ID was already used for different data.",
          409,
        );
      }

      return {
        recorded: existingEvent.historyDeletedAt === null,
        suppressed: existingEvent.historyDeletedAt !== null,
        eventId: existingEvent.eventId,
        serverCreatedAt: existingEvent.createdAt.toISOString(),
      };
    }

    const eventData = {
      eventId: event.eventId,
      userId,
      scope: event.scope,
      query: event.query,
      queryKey,
      filters: event.filters,
      trigger: event.trigger,
      locale: event.locale,
      clientSearchedAt,
      effectiveClientSearchedAt,
    };

    if (event.trigger === "search_commit") {
      const deletion = await transaction.searchHistoryDeletion.findFirst({
        where: {
          userId,
          scope: event.scope,
          queryKey: {
            in: [GLOBAL_SEARCH_HISTORY_QUERY_KEY, queryKey],
          },
        },
        orderBy: { effectiveClientDeletedAt: "desc" },
        select: {
          effectiveClientDeletedAt: true,
        },
      });

      if (
        deletion &&
        isSearchEventSuppressedByDeletion(
          event.trigger,
          effectiveClientSearchedAt,
          deletion.effectiveClientDeletedAt,
        )
      ) {
        const storedEvent = await transaction.searchEvent.create({
          data: {
            ...eventData,
            historyDeletedAt: new Date(),
          },
          select: {
            eventId: true,
            createdAt: true,
          },
        });

        return {
          recorded: false,
          suppressed: true,
          eventId: storedEvent.eventId,
          serverCreatedAt: storedEvent.createdAt.toISOString(),
        };
      }
    }

    const storedEvent = await transaction.searchEvent.create({
      data: eventData,
      select: {
        eventId: true,
        createdAt: true,
      },
    });

    return {
      recorded: true,
      suppressed: false,
      eventId: storedEvent.eventId,
      serverCreatedAt: storedEvent.createdAt.toISOString(),
    };
  });

export const getUserSearchHistory = async (
  userId: number,
  scope: SearchHistoryScope,
): Promise<SearchHistoryItem[]> => {
  if (userId <= 0) {
    return [];
  }

  // DISTINCT ON keeps the latest server-confirmed event for each normalized
  // query and is backed by the user/scope/queryKey index.
  const rows = await prisma.$queryRaw<SearchHistoryRow[]>`
    SELECT
      history."query",
      history."clientSearchedAt",
      history."createdAt"
    FROM (
      SELECT DISTINCT ON ("queryKey")
        "eventId",
        "query",
        "clientSearchedAt",
        "createdAt"
      FROM "SearchEvent"
      WHERE
        "userId" = ${userId}
        AND "scope" = CAST(${scope} AS "SearchScope")
        AND "trigger" = CAST('search_commit' AS "SearchEventTrigger")
        AND "historyDeletedAt" IS NULL
        AND "queryKey" <> ''
      ORDER BY
        "queryKey",
        "createdAt" DESC,
        "eventId" DESC
    ) AS history
    ORDER BY
      history."createdAt" DESC,
      history."eventId" DESC
    LIMIT ${SEARCH_HISTORY_LIMIT}
  `;

  return buildSearchHistoryItems(rows);
};

export const deleteUserSearchHistory = async (
  userId: number,
  input: DeleteSearchHistoryInput,
): Promise<number> => {
  if (userId <= 0) {
    return 0;
  }

  return prisma.$transaction(async (transaction) => {
    await lockSearchHistoryOwner(transaction, userId);

    const queryKey = input.query
      ? getSearchHistoryQueryKey(input.query)
      : GLOBAL_SEARCH_HISTORY_QUERY_KEY;
    const clientDeletedAt = new Date(input.clientDeletedAt);
    const existingDeletion =
      await transaction.searchHistoryDeletion.findUnique({
        where: { operationId: input.operationId },
        select: {
          userId: true,
          scope: true,
          queryKey: true,
          clientDeletedAt: true,
          effectiveClientDeletedAt: true,
        },
      });

    if (
      existingDeletion &&
      (existingDeletion.userId !== userId ||
        existingDeletion.scope !== input.scope ||
        existingDeletion.queryKey !== queryKey ||
        existingDeletion.clientDeletedAt.getTime() !==
          clientDeletedAt.getTime())
    ) {
      throw new ApplicationError(
        "SEARCH_HISTORY_DELETE_CONFLICT",
        "Search history deletion ID was already used for different data.",
        409,
      );
    }

    const deletion =
      existingDeletion ??
      (await transaction.searchHistoryDeletion.create({
        data: {
          operationId: input.operationId,
          userId,
          scope: input.scope,
          queryKey,
          clientDeletedAt,
          effectiveClientDeletedAt: getEffectiveClientTimestamp(
            clientDeletedAt,
            new Date(),
          ),
        },
        select: {
          effectiveClientDeletedAt: true,
        },
      }));
    const historyDeletedAt = new Date();
    const result = await transaction.searchEvent.updateMany({
      where: {
        userId,
        scope: input.scope,
        trigger: "search_commit",
        historyDeletedAt: null,
        effectiveClientSearchedAt: {
          lte: deletion.effectiveClientDeletedAt,
        },
        ...(input.query ? { queryKey } : {}),
      },
      data: { historyDeletedAt },
    });

    return result.count;
  });
};
