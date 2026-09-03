import { z } from "zod";

import { ApiRequestError } from "@/shared/api";

import { searchHistoryClient } from "../api/search-history-client";
import {
  deleteSearchHistorySchema,
  recordSearchEventSchema,
  type DeleteSearchHistoryInput,
  type RecordSearchEventInput,
} from "../model/contracts";

const getLegacyOutboxStorageKey = (expectedUserId: number) =>
  `favor:search-history-outbox:user:${expectedUserId}:v1`;

const getOperationStoragePrefix = (expectedUserId: number) =>
  `favor:search-history-outbox-operation:user:${expectedUserId}:v2:`;

export const isSearchHistoryOutboxStorageKeyForUser = (
  storageKey: string | null,
  expectedUserId: number,
) => storageKey?.startsWith(getOperationStoragePrefix(expectedUserId)) ?? false;

const getOperationStorageKey = (expectedUserId: number, operationId: string) =>
  `${getOperationStoragePrefix(expectedUserId)}${operationId}`;

const getOutboxLockName = (expectedUserId: number) =>
  `favor:search-history-outbox:user:${expectedUserId}`;

const searchHistoryOutboxOperationSchema = z
  .discriminatedUnion("kind", [
    z
      .object({
        id: z.uuid(),
        kind: z.literal("record"),
        payload: recordSearchEventSchema,
      })
      .strict(),
    z
      .object({
        id: z.uuid(),
        kind: z.literal("delete"),
        payload: deleteSearchHistorySchema,
      })
      .strict(),
  ])
  .refine(
    (operation) =>
      operation.id ===
      (operation.kind === "record"
        ? operation.payload.eventId
        : operation.payload.operationId),
    {
      message: "Outbox operation ID must match its payload ID.",
      path: ["id"],
    },
  );

const legacySearchHistoryOutboxSchema = z
  .object({
    version: z.literal(1),
    operations: z.array(z.unknown()),
  })
  .strict();

const storedSearchHistoryOperationSchema = z
  .object({
    version: z.literal(2),
    queuedAt: z.number().int().nonnegative(),
    operation: searchHistoryOutboxOperationSchema,
  })
  .strict();

export type SearchHistoryOutboxOperation = z.infer<
  typeof searchHistoryOutboxOperationSchema
>;

type StoredSearchHistoryOperation = z.infer<
  typeof storedSearchHistoryOperationSchema
>;

type SearchHistoryOutboxStorage = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem" | "key" | "length"
>;

type QueuedSearchHistoryOperation = StoredSearchHistoryOperation & {
  storageKey?: string;
  storage?: SearchHistoryOutboxStorage;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const addLegacyOperationDefaults = (operation: unknown) => {
  if (!isRecord(operation) || !isRecord(operation.payload)) {
    return operation;
  }

  if (operation.kind === "record" && !("trigger" in operation.payload)) {
    return {
      ...operation,
      payload: { ...operation.payload, trigger: "search_commit" },
    };
  }

  if (
    operation.kind === "delete" &&
    (!("clientDeletedAt" in operation.payload) ||
      !("operationId" in operation.payload))
  ) {
    return {
      ...operation,
      payload: {
        ...operation.payload,
        operationId:
          "operationId" in operation.payload
            ? operation.payload.operationId
            : operation.id,
        clientDeletedAt:
          "clientDeletedAt" in operation.payload
            ? operation.payload.clientDeletedAt
            : new Date().toISOString(),
      },
    };
  }

  return operation;
};

export const parseSearchHistoryOutbox = (
  rawValue: string | null,
): SearchHistoryOutboxOperation[] => {
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = legacySearchHistoryOutboxSchema.parse(JSON.parse(rawValue));
    return parsed.operations.flatMap((operation) => {
      const result = searchHistoryOutboxOperationSchema.safeParse(
        addLegacyOperationDefaults(operation),
      );
      return result.success ? [result.data] : [];
    });
  } catch {
    return [];
  }
};

export const serializeSearchHistoryOutbox = (
  operations: readonly SearchHistoryOutboxOperation[],
) =>
  JSON.stringify({
    version: 1,
    operations,
  });

export const getSearchHistoryOutboxOperationsForUser = (
  operations: readonly SearchHistoryOutboxOperation[],
  expectedUserId: number,
) =>
  operations.filter(
    (operation) => operation.payload.expectedUserId === expectedUserId,
  );

const getBrowserStorages = (): SearchHistoryOutboxStorage[] => {
  if (typeof window === "undefined") {
    return [];
  }

  const storages: SearchHistoryOutboxStorage[] = [];
  for (const getStorage of [
    () => window.localStorage,
    () => window.sessionStorage,
  ]) {
    try {
      storages.push(getStorage());
    } catch {
      // The next storage tier or the in-memory queue remains available.
    }
  }

  return storages;
};

let lastQueuedAt = 0;

const getNextQueuedAt = () => {
  const highResolutionNow =
    typeof performance !== "undefined"
      ? Math.floor((performance.timeOrigin + performance.now()) * 1000)
      : Date.now() * 1000;
  lastQueuedAt = Math.max(highResolutionNow, lastQueuedAt + 1);
  return lastQueuedAt;
};

const writeStoredOperation = (
  storage: SearchHistoryOutboxStorage,
  operation: SearchHistoryOutboxOperation,
  queuedAt: number,
) => {
  try {
    storage.setItem(
      getOperationStorageKey(
        operation.payload.expectedUserId,
        operation.id,
      ),
      JSON.stringify({ version: 2, queuedAt, operation }),
    );
    return true;
  } catch {
    return false;
  }
};

const migrateLegacyOutbox = (
  storage: SearchHistoryOutboxStorage,
  expectedUserId: number,
) => {
  const legacyKey = getLegacyOutboxStorageKey(expectedUserId);
  let rawValue: string | null;

  try {
    rawValue = storage.getItem(legacyKey);
  } catch {
    return false;
  }

  if (!rawValue) {
    return true;
  }

  const operations = getSearchHistoryOutboxOperationsForUser(
    parseSearchHistoryOutbox(rawValue),
    expectedUserId,
  );

  for (const operation of operations) {
    const operationKey = getOperationStorageKey(expectedUserId, operation.id);
    try {
      if (
        storage.getItem(operationKey) === null &&
        !writeStoredOperation(storage, operation, getNextQueuedAt())
      ) {
        return false;
      }
    } catch {
      return false;
    }
  }

  try {
    storage.removeItem(legacyKey);
    return true;
  } catch {
    return false;
  }
};

const readStoredOperations = (
  storage: SearchHistoryOutboxStorage,
  expectedUserId: number,
): QueuedSearchHistoryOperation[] => {
  migrateLegacyOutbox(storage, expectedUserId);
  const prefix = getOperationStoragePrefix(expectedUserId);
  const keys: string[] = [];

  try {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key?.startsWith(prefix)) {
        keys.push(key);
      }
    }
  } catch {
    return [];
  }

  const operations: QueuedSearchHistoryOperation[] = [];
  for (const storageKey of keys) {
    try {
      const rawValue = storage.getItem(storageKey);
      const parsed = storedSearchHistoryOperationSchema.safeParse(
        rawValue ? JSON.parse(rawValue) : null,
      );
      if (
        !parsed.success ||
        parsed.data.operation.payload.expectedUserId !== expectedUserId ||
        storageKey !==
          getOperationStorageKey(
            expectedUserId,
            parsed.data.operation.id,
          )
      ) {
        storage.removeItem(storageKey);
        continue;
      }

      operations.push({ ...parsed.data, storageKey, storage });
    } catch {
      try {
        storage.removeItem(storageKey);
      } catch {
        // A corrupt entry is ignored without affecting the remaining queue.
      }
    }
  }

  return operations.sort(
    (left, right) =>
      left.queuedAt - right.queuedAt ||
      left.operation.id.localeCompare(right.operation.id),
  );
};

const inMemoryOperations = new Map<
  number,
  QueuedSearchHistoryOperation[]
>();

const enqueueInMemory = (operation: SearchHistoryOutboxOperation) => {
  const expectedUserId = operation.payload.expectedUserId;
  const operations = inMemoryOperations.get(expectedUserId) ?? [];
  inMemoryOperations.set(expectedUserId, [
    ...operations.filter((item) => item.operation.id !== operation.id),
    { version: 2, queuedAt: getNextQueuedAt(), operation },
  ]);
};

const removeInMemoryOperation = (
  expectedUserId: number,
  operationId: string,
) => {
  const operations = inMemoryOperations.get(expectedUserId) ?? [];
  inMemoryOperations.set(
    expectedUserId,
    operations.filter((item) => item.operation.id !== operationId),
  );
};

export const enqueueSearchHistoryOperation = (
  operation: SearchHistoryOutboxOperation,
) => {
  for (const storage of getBrowserStorages()) {
    if (
      migrateLegacyOutbox(storage, operation.payload.expectedUserId) &&
      writeStoredOperation(storage, operation, getNextQueuedAt())
    ) {
      removeInMemoryOperation(
        operation.payload.expectedUserId,
        operation.id,
      );
      return true;
    }
  }

  enqueueInMemory(operation);
  return false;
};

const executeSearchHistoryOperation = (
  operation: SearchHistoryOutboxOperation,
) =>
  operation.kind === "record"
    ? searchHistoryClient.record(operation.payload)
    : searchHistoryClient.remove(operation.payload);

const NON_RETRYABLE_SEARCH_HISTORY_STATUSES = new Set([
  400,
  409,
  413,
  422,
]);

const isNonRetryableClientError = (error: unknown) =>
  error instanceof ApiRequestError &&
  typeof error.status === "number" &&
  NON_RETRYABLE_SEARCH_HISTORY_STATUSES.has(error.status) &&
  error.code !== "SEARCH_HISTORY_ACCOUNT_CHANGED";

const isAuthenticationBlockedError = (error: unknown) =>
  error instanceof ApiRequestError &&
  (error.status === 401 || error.code === "SEARCH_HISTORY_ACCOUNT_CHANGED");

type FlushSearchHistoryOutcome =
  | "complete"
  | "transient_failure"
  | "authentication_blocked";

const getQueuedOperations = (
  storages: readonly SearchHistoryOutboxStorage[],
  expectedUserId: number,
) => {
  const persistedOperations = storages.flatMap((storage) =>
    readStoredOperations(storage, expectedUserId),
  );
  const memoryOperations = inMemoryOperations.get(expectedUserId) ?? [];

  return [...persistedOperations, ...memoryOperations].sort(
    (left, right) =>
      left.queuedAt - right.queuedAt ||
      left.operation.id.localeCompare(right.operation.id),
  );
};

const acknowledgeOperation = (
  expectedUserId: number,
  queuedOperation: QueuedSearchHistoryOperation,
) => {
  if (queuedOperation.storageKey && queuedOperation.storage) {
    try {
      queuedOperation.storage.removeItem(queuedOperation.storageKey);
      return true;
    } catch {
      return false;
    }
  }

  removeInMemoryOperation(
    expectedUserId,
    queuedOperation.operation.id,
  );
  return true;
};

const flushQueuedOperations = async (
  expectedUserId: number,
): Promise<FlushSearchHistoryOutcome> => {
  const storages = getBrowserStorages();

  while (true) {
    const queuedOperations = getQueuedOperations(storages, expectedUserId);
    if (queuedOperations.length === 0) {
      return "complete";
    }

    for (const queuedOperation of queuedOperations) {
      try {
        await executeSearchHistoryOperation(queuedOperation.operation);
      } catch (error) {
        if (!isNonRetryableClientError(error)) {
          return isAuthenticationBlockedError(error)
            ? "authentication_blocked"
            : "transient_failure";
        }
      }

      if (!acknowledgeOperation(expectedUserId, queuedOperation)) {
        return "transient_failure";
      }
    }
  }
};

const flushWithCrossTabLock = async (expectedUserId: number) => {
  if (typeof navigator !== "undefined" && navigator.locks) {
    return navigator.locks.request(
      getOutboxLockName(expectedUserId),
      { mode: "exclusive" },
      () => flushQueuedOperations(expectedUserId),
    );
  }

  return flushQueuedOperations(expectedUserId);
};

const flushPromises = new Map<number, Promise<boolean>>();
const retryTimers = new Map<number, ReturnType<typeof setTimeout>>();
const retryAttempts = new Map<number, number>();

const clearRetryState = (expectedUserId: number) => {
  const retryTimer = retryTimers.get(expectedUserId);
  if (retryTimer) {
    clearTimeout(retryTimer);
  }
  retryTimers.delete(expectedUserId);
  retryAttempts.delete(expectedUserId);
};

const scheduleRetry = (expectedUserId: number) => {
  if (retryTimers.has(expectedUserId)) {
    return;
  }

  const attempt = (retryAttempts.get(expectedUserId) ?? 0) + 1;
  retryAttempts.set(expectedUserId, attempt);
  const baseDelay = Math.min(60_000, 1000 * 2 ** Math.min(attempt - 1, 6));
  const delay = Math.round(baseDelay * (0.8 + Math.random() * 0.4));
  const retryTimer = setTimeout(() => {
    retryTimers.delete(expectedUserId);
    void flushSearchHistoryOutbox(expectedUserId);
  }, delay);
  retryTimers.set(expectedUserId, retryTimer);
};

export const flushSearchHistoryOutbox = (expectedUserId: number) => {
  const existingPromise = flushPromises.get(expectedUserId);
  if (existingPromise) {
    return existingPromise;
  }

  const flushPromise = flushWithCrossTabLock(expectedUserId)
    .catch(() => "transient_failure" as const)
    .then((outcome) => {
      if (outcome === "transient_failure") {
        scheduleRetry(expectedUserId);
      } else {
        clearRetryState(expectedUserId);
      }

      return outcome === "complete";
    })
    .finally(() => {
      flushPromises.delete(expectedUserId);
    });
  flushPromises.set(expectedUserId, flushPromise);
  return flushPromise;
};

const submitSearchHistoryOperation = (
  operation: SearchHistoryOutboxOperation,
  flushImmediately: boolean,
) => {
  clearRetryState(operation.payload.expectedUserId);
  enqueueSearchHistoryOperation(operation);
  if (flushImmediately) {
    void flushSearchHistoryOutbox(operation.payload.expectedUserId);
  }
};

export const queueSearchHistoryRecord = (
  payload: RecordSearchEventInput,
  flushImmediately = true,
) => {
  submitSearchHistoryOperation(
    {
      id: payload.eventId,
      kind: "record",
      payload,
    },
    flushImmediately,
  );
};

export const queueSearchHistoryDelete = (
  payload: DeleteSearchHistoryInput,
  flushImmediately = true,
) => {
  submitSearchHistoryOperation(
    { id: payload.operationId, kind: "delete", payload },
    flushImmediately,
  );
};
