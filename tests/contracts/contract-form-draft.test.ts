import assert from "node:assert/strict";
import test from "node:test";

import {
  buildContractFormDraftStorageKey,
  createGuardedContractDraftStorage,
  contractFormDraftSnapshotSchema,
} from "../../src/entities/contract/model/form-draft";
import {
  defaultContractFormState,
  mapContractFormToUpdateDto,
} from "../../src/entities/contract/model/form";
import {
  claimAnonymousCreateContractDraft,
  restoreCreateContractDraftClaimBackup,
  selectPersistedCreateContractDraft,
} from "../../src/features/create-contract/model/draft-persistence";
import { planCreateContractDraftOwnerTransition } from "../../src/features/create-contract/model/draft-owner";
import {
  mergeEditContractDraftWithLatest,
  parseRestorableEditContractDraft,
  selectPersistedEditContractDraft,
} from "../../src/features/edit-contract/model/draft-persistence";
import { createSafeBrowserStorage } from "../../src/shared/lib/storage";

const editedForm = {
  ...defaultContractFormState,
  titleEn: "Recovered contract draft",
  descriptionEn:
    "These unsaved changes must survive an expired authenticated session.",
};

class MemoryStorage {
  readonly values = new Map<string, string>();
  failReads = false;
  failWrites = false;
  failRemoves = false;

  getItem(key: string) {
    if (this.failReads) {
      throw new Error("storage read failed");
    }

    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    if (this.failWrites) {
      throw new Error("storage write failed");
    }

    this.values.set(key, value);
  }

  removeItem(key: string) {
    if (this.failRemoves) {
      throw new Error("storage remove failed");
    }

    this.values.delete(key);
  }
}

test("create draft owner resolution keeps an authenticated form sticky", () => {
  assert.deepEqual(
    planCreateContractDraftOwnerTransition(undefined, undefined),
    { kind: "keep", ownerId: undefined },
  );
  assert.deepEqual(planCreateContractDraftOwnerTransition(undefined, null), {
    kind: "select",
    ownerId: null,
  });
  assert.deepEqual(planCreateContractDraftOwnerTransition(undefined, 10), {
    kind: "claim_anonymous",
    ownerId: 10,
    fallbackOwnerId: null,
  });
  assert.deepEqual(planCreateContractDraftOwnerTransition(null, 10), {
    kind: "claim_anonymous",
    ownerId: 10,
    fallbackOwnerId: null,
  });
  assert.deepEqual(planCreateContractDraftOwnerTransition(10, null), {
    kind: "keep",
    ownerId: 10,
  });
  assert.deepEqual(planCreateContractDraftOwnerTransition(10, undefined), {
    kind: "keep",
    ownerId: 10,
  });
  assert.deepEqual(planCreateContractDraftOwnerTransition(10, 10), {
    kind: "keep",
    ownerId: 10,
  });
  assert.deepEqual(planCreateContractDraftOwnerTransition(10, 11), {
    kind: "select",
    ownerId: 11,
  });
});

test("contract draft storage is isolated by user, mode and contract", () => {
  const firstUserCreate = buildContractFormDraftStorageKey({
    kind: "create",
    ownerId: 10,
  });
  const secondUserCreate = buildContractFormDraftStorageKey({
    kind: "create",
    ownerId: 11,
  });
  const anonymousCreate = buildContractFormDraftStorageKey({
    kind: "create",
    ownerId: null,
  });
  const firstContractEdit = buildContractFormDraftStorageKey({
    kind: "edit",
    ownerId: 10,
    contractId: 100,
  });
  const secondContractEdit = buildContractFormDraftStorageKey({
    kind: "edit",
    ownerId: 10,
    contractId: 101,
  });

  assert.equal(new Set([
    firstUserCreate,
    secondUserCreate,
    anonymousCreate,
    firstContractEdit,
    secondContractEdit,
  ]).size, 5);
  assert.match(firstUserCreate, /:user:10:create$/);
  assert.match(anonymousCreate, /:anonymous:create$/);
  assert.match(firstContractEdit, /:user:10:contract:100$/);
});

test("contract draft storage supports the synthetic dev user and rejects unsafe identifiers", () => {
  assert.match(
    buildContractFormDraftStorageKey({ kind: "create", ownerId: 0 }),
    /:user:dev:create$/,
  );
  assert.throws(() =>
    buildContractFormDraftStorageKey({ kind: "create", ownerId: -1 }),
  );
  assert.throws(() =>
    buildContractFormDraftStorageKey({
      kind: "edit",
      ownerId: 10,
      contractId: Number.NaN,
    }),
  );
});

test("persisted snapshots accept only whitelisted form data", () => {
  const parsed = contractFormDraftSnapshotSchema.safeParse({
    form: editedForm,
    preview: null,
    sessionToken: "must-not-be-persisted",
  });

  assert.equal(parsed.success, false);
});

test("create draft persistence excludes the Telegram publication bearer token", () => {
  const runtimeState = {
    form: editedForm,
    preview: null,
    addTelegramPostButton: true,
    lastClaimedToken: "secret-publication-token",
  };
  const persisted = selectPersistedCreateContractDraft(runtimeState);

  assert.deepEqual(persisted, {
    form: editedForm,
    preview: null,
    addTelegramPostButton: true,
  });
  assert.doesNotMatch(JSON.stringify(persisted), /secret-publication-token/);
});

test("legacy global create draft remains quarantined and untouched", () => {
  const storage = new MemoryStorage();
  const userDestinationKey = buildContractFormDraftStorageKey({
    kind: "create",
    ownerId: 10,
  });
  const legacyRaw = JSON.stringify({
    state: {
      form: editedForm,
      preview: null,
      addTelegramPostButton: true,
      lastClaimedToken: "legacy-secret-token",
    },
    version: 2,
  });
  storage.setItem("favor:create-contract-draft", legacyRaw);

  assert.equal(claimAnonymousCreateContractDraft(storage, 10), "no_source");
  assert.equal(storage.getItem("favor:create-contract-draft"), legacyRaw);
  assert.equal(storage.getItem(userDestinationKey), null);
});

test("an anonymous draft stays active after login and backs up an existing account draft", () => {
  const storage = new MemoryStorage();
  const anonymousKey = buildContractFormDraftStorageKey({
    kind: "create",
    ownerId: null,
  });
  const userKey = buildContractFormDraftStorageKey({
    kind: "create",
    ownerId: 10,
  });
  storage.setItem(
    anonymousKey,
    JSON.stringify({
      state: {
        form: editedForm,
        preview: null,
        addTelegramPostButton: false,
      },
      version: 1,
    }),
  );

  assert.equal(claimAnonymousCreateContractDraft(storage, 10), "migrated");
  assert.equal(storage.getItem(anonymousKey), null);
  assert.ok(storage.getItem(userKey)?.includes("Recovered contract draft"));

  const newerAnonymousForm = {
    ...editedForm,
    titleEn: "Newest anonymous draft",
  };
  storage.setItem(
    anonymousKey,
    JSON.stringify({
      state: {
        form: newerAnonymousForm,
        preview: null,
        addTelegramPostButton: true,
      },
      version: 1,
    }),
  );
  const existingUserDraft = storage.getItem(userKey);
  assert.equal(
    claimAnonymousCreateContractDraft(storage, 10),
    "destination_replaced",
  );
  assert.equal(
    storage.getItem(`${userKey}:claim-backup:1`),
    existingUserDraft,
  );
  assert.ok(storage.getItem(userKey)?.includes("Newest anonymous draft"));
  assert.equal(storage.getItem(anonymousKey), null);

  assert.equal(
    restoreCreateContractDraftClaimBackup(storage, 10, 1),
    "restored",
  );
  assert.ok(storage.getItem(userKey)?.includes("Recovered contract draft"));
  assert.ok(
    storage.getItem(`${userKey}:claim-backup:2`)?.includes(
      "Newest anonymous draft",
    ),
  );
});

test("a failed anonymous cleanup keeps that scope active until a later safe claim", () => {
  const storage = new MemoryStorage();
  const anonymousKey = buildContractFormDraftStorageKey({
    kind: "create",
    ownerId: null,
  });
  const userKey = buildContractFormDraftStorageKey({
    kind: "create",
    ownerId: 10,
  });
  storage.setItem(
    anonymousKey,
    JSON.stringify({
      state: {
        form: editedForm,
        preview: null,
        addTelegramPostButton: false,
      },
      version: 1,
    }),
  );
  storage.failRemoves = true;

  assert.equal(claimAnonymousCreateContractDraft(storage, 10), "failed");
  assert.ok(storage.getItem(anonymousKey)?.includes("Recovered contract draft"));
  assert.ok(storage.getItem(userKey)?.includes("Recovered contract draft"));

  const newerAnonymousForm = {
    ...editedForm,
    titleEn: "Edit made after the failed cleanup",
  };
  storage.failRemoves = false;
  storage.setItem(
    anonymousKey,
    JSON.stringify({
      state: {
        form: newerAnonymousForm,
        preview: null,
        addTelegramPostButton: true,
      },
      version: 1,
    }),
  );

  assert.equal(
    claimAnonymousCreateContractDraft(storage, 10),
    "destination_replaced",
  );
  assert.ok(storage.getItem(userKey)?.includes("failed cleanup"));
  assert.equal(storage.getItem(anonymousKey), null);
});

test("edit draft remains recoverable after the server revision changes", () => {
  const persisted = selectPersistedEditContractDraft({
    form: editedForm,
    preview: null,
    baseContractUpdatedAt: "2026-08-27T10:00:00.000Z",
    isDirty: true,
  });

  assert.deepEqual(
    parseRestorableEditContractDraft(
      persisted,
    ),
    persisted,
  );
  assert.deepEqual(
    parseRestorableEditContractDraft(
      persisted,
    ),
    persisted,
  );
});

test("clean and malformed edit snapshots are not restored", () => {
  assert.equal(
    parseRestorableEditContractDraft(
      {
        form: editedForm,
        preview: null,
        baseContractUpdatedAt: "2026-08-27T10:00:00.000Z",
        isDirty: false,
      },
    ),
    null,
  );
  assert.equal(
    parseRestorableEditContractDraft(
      {
        form: editedForm,
        preview: null,
        baseContractUpdatedAt: "2026-08-27T10:00:00.000Z",
        isDirty: true,
        authToken: "unexpected",
      },
    ),
    null,
  );
});

test("edit drafts three-way merge non-conflicting server and local changes", () => {
  const latestForm = {
    ...defaultContractFormState,
    deadlineDays: "14",
  };
  const merged = mergeEditContractDraftWithLatest(
    {
      form: editedForm,
      preview: null,
      baseForm: defaultContractFormState,
      basePreview: null,
      baseContractUpdatedAt: "2026-08-27T10:00:00.000Z",
      isDirty: true,
    },
    latestForm,
    null,
    "2026-08-27T10:05:00.000Z",
  );

  assert.equal(merged.hasRevisionConflict, false);
  assert.equal(merged.form.titleEn, editedForm.titleEn);
  assert.equal(merged.form.deadlineDays, "14");
  assert.equal(merged.baseContractUpdatedAt, "2026-08-27T10:05:00.000Z");
});

test("edit drafts surface overlapping changes instead of dropping either draft", () => {
  const latestForm = {
    ...defaultContractFormState,
    titleEn: "Server-side title",
  };
  const merged = mergeEditContractDraftWithLatest(
    {
      form: editedForm,
      preview: null,
      baseForm: defaultContractFormState,
      basePreview: null,
      baseContractUpdatedAt: "2026-08-27T10:00:00.000Z",
      isDirty: true,
    },
    latestForm,
    null,
    "2026-08-27T10:05:00.000Z",
  );

  assert.equal(merged.hasRevisionConflict, true);
  assert.equal(merged.form.titleEn, editedForm.titleEn);
  assert.equal(merged.baseContractUpdatedAt, "2026-08-27T10:00:00.000Z");
});

test("edit update payload includes the expected revision and changed fields only", () => {
  const payload = mapContractFormToUpdateDto(
    editedForm,
    defaultContractFormState,
    42,
    "2026-08-27T10:00:00.000Z",
  );

  assert.deepEqual(payload, {
    titleEn: editedForm.titleEn,
    descriptionEn: editedForm.descriptionEn,
    contractId: 42,
    baseUpdatedAt: "2026-08-27T10:00:00.000Z",
  });
});

test("a failed draft read cannot overwrite the saved snapshot during hydration", () => {
  const storage = new MemoryStorage();
  const storageKey = "draft";
  const savedSnapshot = JSON.stringify({ value: "saved draft" });
  const reportedErrors: unknown[] = [];
  storage.setItem(storageKey, savedSnapshot);
  storage.failReads = true;

  const guardedStorage = createGuardedContractDraftStorage(
    () => storage,
    (error) => reportedErrors.push(error),
  );

  assert.equal(guardedStorage.getItem(storageKey), null);
  assert.equal(guardedStorage.didInitialReadFail(), true);

  guardedStorage.setItem(
    storageKey,
    JSON.stringify({ value: "default hydration state" }),
  );
  assert.equal(storage.values.get(storageKey), savedSnapshot);

  storage.failReads = false;
  guardedStorage.allowExplicitWrites();
  guardedStorage.setItem(
    storageKey,
    JSON.stringify({ value: "explicit user change" }),
  );
  assert.equal(
    storage.values.get(storageKey),
    JSON.stringify({ value: "explicit user change" }),
  );
  assert.equal(reportedErrors.length, 1);
});

test("an unavailable storage resolver does not authorize a default write", () => {
  const storage = new MemoryStorage();
  const storageKey = "draft";
  const savedSnapshot = JSON.stringify({ value: "saved draft" });
  let isStorageAvailable = false;
  storage.setItem(storageKey, savedSnapshot);

  const guardedStorage = createGuardedContractDraftStorage(
    () => (isStorageAvailable ? storage : null),
    () => undefined,
  );

  assert.equal(guardedStorage.getItem(storageKey), null);
  guardedStorage.setItem(
    storageKey,
    JSON.stringify({ value: "default hydration state" }),
  );

  isStorageAvailable = true;
  assert.equal(storage.getItem(storageKey), savedSnapshot);
  assert.equal(guardedStorage.getItem(storageKey), savedSnapshot);

  guardedStorage.setItem(
    storageKey,
    JSON.stringify({ value: "write after successful read" }),
  );
  assert.equal(
    storage.getItem(storageKey),
    JSON.stringify({ value: "write after successful read" }),
  );
});

test("browser draft storage failures are reported without escaping to the UI", async () => {
  const reportedErrors: unknown[] = [];
  const failingStorage = {
    getItem: () => {
      throw new Error("read denied");
    },
    setItem: () => {
      throw new Error("write denied");
    },
    removeItem: () => {
      throw new Error("remove denied");
    },
  };
  const storage = createSafeBrowserStorage(
    () => failingStorage,
    (error) => reportedErrors.push(error),
  );

  assert.equal(await storage.getItem("draft"), null);
  await storage.setItem("draft", "value");
  await storage.removeItem("draft");
  assert.equal(reportedErrors.length, 3);
});
