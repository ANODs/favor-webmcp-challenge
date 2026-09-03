import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { Role } from "@prisma/client";
import { z } from "zod";

import { ApplicationError } from "../../src/shared/lib/application-error";
import { handleRouteError } from "../../src/shared/lib/api";
import {
  checkContractLimitWithClient,
  CONTRACT_LIMIT_ERROR_CODE,
} from "../../src/shared/lib/contract-limits";
import { createRateLimitError } from "../../src/shared/lib/rate-limit";
import {
  createTurnstileError,
  type TurnstileErrorCode,
} from "../../src/shared/lib/turnstile";

type ErrorEnvelope = {
  ok: false;
  error: string;
  details?: unknown;
};

const readErrorEnvelope = (response: Response) =>
  response.json() as Promise<ErrorEnvelope>;

test("route errors preserve the ApplicationError status, code, details, and headers", async () => {
  const response = handleRouteError(
    new ApplicationError(
      "RESOURCE_CONFLICT",
      "The resource changed.",
      409,
      { resourceId: 42 },
      { ETag: '"revision-2"' },
    ),
  );

  assert.equal(response.status, 409);
  assert.equal(response.headers.get("etag"), '"revision-2"');
  assert.deepEqual(await readErrorEnvelope(response), {
    ok: false,
    error: "The resource changed.",
    details: { code: "RESOURCE_CONFLICT", resourceId: 42 },
  });
});

test("legacy route sentinels expose stable status and error codes", async () => {
  const cases = [
    ["UNAUTHORIZED", 401, "Authentication required."],
    ["NOT_FOUND", 404, "Resource not found."],
    ["FORBIDDEN", 403, "You do not have permission to perform this action."],
  ] as const;

  for (const [sentinel, status, message] of cases) {
    const response = handleRouteError(new Error(sentinel));
    assert.equal(response.status, status);
    assert.deepEqual(await readErrorEnvelope(response), {
      ok: false,
      error: message,
      details: {
        code:
          sentinel === "UNAUTHORIZED"
            ? "AUTH_SESSION_REQUIRED"
            : sentinel,
      },
    });
  }
});

test("machine-readable route errors remain compatible and gain details.code", async () => {
  const response = handleRouteError(new Error("BID_RACE_LOST"));

  assert.equal(response.status, 400);
  assert.deepEqual(await readErrorEnvelope(response), {
    ok: false,
    error: "BID_RACE_LOST",
    details: { code: "BID_RACE_LOST" },
  });
});

test("raw human error messages are not exposed", async () => {
  const response = handleRouteError(new Error("Database row 42 failed to deserialize"));

  assert.equal(response.status, 400);
  assert.deepEqual(await readErrorEnvelope(response), {
    ok: false,
    error: "Request could not be processed.",
    details: { code: "BAD_REQUEST" },
  });
});

test("database outages remain transient service errors rather than auth failures", async () => {
  const response = handleRouteError(new Error("P1001: Can't reach database server"));

  assert.equal(response.status, 503);
  assert.deepEqual(await readErrorEnvelope(response), {
    ok: false,
    error: "The service is temporarily unavailable.",
    details: { code: "SERVICE_UNAVAILABLE" },
  });
});

test("Zod issue arrays keep their client-compatible details shape", async () => {
  const result = z.object({ title: z.string().min(5) }).safeParse({ title: "x" });
  assert.equal(result.success, false);
  if (result.success) return;

  const response = handleRouteError(result.error);
  const body = await readErrorEnvelope(response);

  assert.equal(response.status, 400);
  assert.equal(body.error, "Request validation failed.");
  assert.equal(Array.isArray(body.details), true);
  assert.deepEqual((body.details as Array<{ path: PropertyKey[] }>)[0]?.path, ["title"]);
});

test("contract limit failures expose a stable code and structured parameters", async () => {
  const database = {
    contract: {
      count: async () => 1,
    },
  } as unknown as Parameters<typeof checkContractLimitWithClient>[0];

  const result = await checkContractLimitWithClient(
    database,
    42,
    false,
    false,
    Role.customer,
  );

  assert.equal(result.allowed, false);
  if (result.allowed) return;
  assert.equal(result.code, CONTRACT_LIMIT_ERROR_CODE);
  assert.equal(result.status, 400);
  assert.deepEqual(result.details, {
    contractKind: "standard",
    current: 1,
    limit: 1,
    isPremium: false,
    upgradeLimit: 5,
  });
  assert.match(result.error, /Favor Plus/);
});

test("rate limit responses preserve retry metadata without clearing cookies", async () => {
  const error = createRateLimitError(17);

  assert.equal(error.code, "RATE_LIMITED");
  assert.equal(error.status, 429);
  assert.deepEqual(error.details, { retryAfterSeconds: 17 });
  assert.deepEqual(error.headers, { "Retry-After": "17" });

  const response = handleRouteError(error);
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Retry-After"), "17");
  assert.equal(response.headers.get("Set-Cookie"), null);
  assert.deepEqual(await response.json(), {
    ok: false,
    error: "Too many requests. Try again later.",
    details: { code: "RATE_LIMITED", retryAfterSeconds: 17 },
  });
});

test("Turnstile errors preserve code-specific statuses and action details", () => {
  const cases: Array<[TurnstileErrorCode, number]> = [
    ["CHALLENGE_REQUIRED", 428],
    ["CHALLENGE_FAILED", 403],
    ["CHALLENGE_UNAVAILABLE", 503],
  ];

  for (const [code, status] of cases) {
    const error = createTurnstileError(code, "telegram_auth");
    assert.equal(error.code, code);
    assert.equal(error.status, status);
    assert.deepEqual(error.details, { action: "telegram_auth" });
  }
});

test("shared error modules contain no Cyrillic source literals", async () => {
  const moduleUrls = [
    new URL("../../src/shared/lib/api.ts", import.meta.url),
    new URL("../../src/shared/lib/contract-limits.ts", import.meta.url),
    new URL("../../src/shared/lib/rate-limit.ts", import.meta.url),
    new URL("../../src/shared/lib/turnstile.ts", import.meta.url),
  ];
  const sources = await Promise.all(moduleUrls.map((url) => readFile(url, "utf8")));
  const cyrillicPattern = /[\u0400-\u04ff]/u;

  for (const source of sources) {
    assert.doesNotMatch(source, cyrillicPattern);
  }
});
