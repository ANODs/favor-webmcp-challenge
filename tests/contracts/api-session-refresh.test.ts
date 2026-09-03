import assert from "node:assert/strict";
import test from "node:test";

import {
  ApiRequestError,
  apiRequest,
  refreshApiSession,
} from "../../src/shared/api/base-client";
import {
  AUTH_SESSION_CLIENT_LOCK_NAME,
} from "../../src/shared/api/auth-session-lock";

const originalFetch = globalThis.fetch;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

test("a 401 response refreshes the session and retries the request once", async () => {
  const calls: string[] = [];
  globalThis.fetch = (async (input) => {
    const path = String(input);
    calls.push(path);

    if (path === "/api/auth/session/refresh") {
      return jsonResponse({
        ok: true,
        data: { refreshed: true, recoveredAccess: false },
      });
    }
    if (calls.filter((call) => call === "/api/protected").length === 1) {
      return jsonResponse({
        ok: false,
        error: "Authentication required.",
        details: { code: "AUTH_SESSION_REQUIRED" },
      }, 401);
    }
    return jsonResponse({ ok: true, data: { value: "saved" } });
  }) as typeof fetch;

  const result = await apiRequest<{ value: string }>({
    path: "/api/protected",
    init: { method: "PATCH", body: JSON.stringify({ title: "Draft" }) },
  });

  assert.deepEqual(result, { value: "saved" });
  assert.deepEqual(calls, [
    "/api/protected",
    "/api/auth/session/refresh",
    "/api/protected",
  ]);
});

test("concurrent 401 responses share one refresh request", async () => {
  let refreshCalls = 0;
  const attempts = new Map<string, number>();
  let releaseRefresh: (() => void) | undefined;
  const refreshGate = new Promise<void>((resolve) => {
    releaseRefresh = resolve;
  });

  globalThis.fetch = (async (input) => {
    const path = String(input);

    if (path === "/api/auth/session/refresh") {
      refreshCalls += 1;
      await refreshGate;
      return jsonResponse({
        ok: true,
        data: { refreshed: true, recoveredAccess: false },
      });
    }

    const attempt = (attempts.get(path) ?? 0) + 1;
    attempts.set(path, attempt);
    if (attempt === 1) {
      return jsonResponse({
        ok: false,
        error: "Authentication required.",
        details: { code: "AUTH_SESSION_REQUIRED" },
      }, 401);
    }
    return jsonResponse({ ok: true, data: { path } });
  }) as typeof fetch;

  const first = apiRequest<{ path: string }>({ path: "/api/first" });
  const second = apiRequest<{ path: string }>({ path: "/api/second" });

  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(refreshCalls, 1);
  releaseRefresh?.();

  assert.deepEqual(await Promise.all([first, second]), [
    { path: "/api/first" },
    { path: "/api/second" },
  ]);
  assert.equal(refreshCalls, 1);
  assert.equal(attempts.get("/api/first"), 2);
  assert.equal(attempts.get("/api/second"), 2);
});

test("a failed refresh preserves the original 401 without retrying forever", async () => {
  let protectedCalls = 0;
  globalThis.fetch = (async (input) => {
    const path = String(input);
    if (path === "/api/auth/session/refresh") {
      return jsonResponse({ ok: false, error: "Authentication required." }, 401);
    }

    protectedCalls += 1;
    return jsonResponse({
      ok: false,
      error: "Authentication required.",
      details: { code: "AUTH_SESSION_REQUIRED" },
    }, 401);
  }) as typeof fetch;

  await assert.rejects(
    apiRequest({ path: "/api/protected" }),
    (error: unknown) => error instanceof ApiRequestError && error.status === 401,
  );
  assert.equal(protectedCalls, 1);
});

test("an unrelated 401 is not refreshed or replayed", async () => {
  const calls: string[] = [];
  globalThis.fetch = (async (input) => {
    calls.push(String(input));
    return jsonResponse({
      ok: false,
      error: "Telegram init data is invalid.",
      details: { code: "TELEGRAM_AUTH_INVALID" },
    }, 401);
  }) as typeof fetch;

  await assert.rejects(
    apiRequest({ path: "/api/telegram/action", init: { method: "POST" } }),
    (error: unknown) => error instanceof ApiRequestError && error.status === 401,
  );
  assert.deepEqual(calls, ["/api/telegram/action"]);
});

test("an aborted request preserves cancellation instead of becoming a network failure", async () => {
  const controller = new AbortController();
  const abortError = new DOMException("Cancelled", "AbortError");
  controller.abort(abortError);
  globalThis.fetch = (async () => {
    throw abortError;
  }) as typeof fetch;

  await assert.rejects(
    apiRequest({
      path: "/api/contracts",
      init: { signal: controller.signal },
    }),
    (error: unknown) => error === abortError,
  );
});

test("a transient refresh failure is surfaced instead of masquerading as logout", async () => {
  let refreshCalls = 0;
  globalThis.fetch = (async (input) => {
    if (String(input) === "/api/auth/session/refresh") {
      refreshCalls += 1;
      return jsonResponse({
        ok: false,
        error: "Session refresh is temporarily unavailable.",
        details: { code: "AUTH_SESSION_REFRESH_UNAVAILABLE" },
      }, 503);
    }

    return jsonResponse({
      ok: false,
      error: "Authentication required.",
      details: { code: "AUTH_SESSION_REQUIRED" },
    }, 401);
  }) as typeof fetch;

  await assert.rejects(
    apiRequest({ path: "/api/protected" }),
    (error: unknown) =>
      error instanceof ApiRequestError &&
      error.status === 503 &&
      error.code === "AUTH_SESSION_REFRESH_UNAVAILABLE",
  );
  assert.equal(refreshCalls, 2);
});

test("a transient refresh failure is retried inside the rotation grace window", async () => {
  let refreshCalls = 0;
  let protectedCalls = 0;
  globalThis.fetch = (async (input) => {
    const path = String(input);
    if (path === "/api/auth/session/refresh") {
      refreshCalls += 1;
      return refreshCalls === 1
        ? jsonResponse({
            ok: false,
            error: "Session refresh is temporarily unavailable.",
            details: { code: "AUTH_SESSION_REFRESH_UNAVAILABLE" },
          }, 503)
        : jsonResponse({
            ok: true,
            data: { refreshed: true, recoveredAccess: true },
          });
    }

    protectedCalls += 1;
    return protectedCalls === 1
      ? jsonResponse({
          ok: false,
          error: "Authentication required.",
          details: { code: "AUTH_SESSION_REQUIRED" },
        }, 401)
      : jsonResponse({ ok: true, data: { value: "recovered" } });
  }) as typeof fetch;

  assert.deepEqual(
    await apiRequest<{ value: string }>({ path: "/api/protected" }),
    { value: "recovered" },
  );
  assert.equal(refreshCalls, 2);
  assert.equal(protectedCalls, 2);
});

test("a rate-limited refresh is not amplified by the bounded retry", async () => {
  let refreshCalls = 0;
  globalThis.fetch = (async (input) => {
    if (String(input) === "/api/auth/session/refresh") {
      refreshCalls += 1;
      return jsonResponse({
        ok: false,
        error: "Too many requests. Try again later.",
        details: { code: "RATE_LIMITED", retryAfterSeconds: 60 },
      }, 429);
    }

    return jsonResponse({
      ok: false,
      error: "Authentication required.",
      details: { code: "AUTH_SESSION_REQUIRED" },
    }, 401);
  }) as typeof fetch;

  await assert.rejects(
    apiRequest({ path: "/api/protected" }),
    (error: unknown) =>
      error instanceof ApiRequestError &&
      error.code === "AUTH_SESSION_REFRESH_UNAVAILABLE",
  );
  assert.equal(refreshCalls, 1);
});

test("auth operations use the origin-wide Web Lock when available", async () => {
  const originalNavigator = Object.getOwnPropertyDescriptor(
    globalThis,
    "navigator",
  );
  const requestedLocks: string[] = [];

  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      locks: {
        request: async <T>(name: string, callback: () => Promise<T>) => {
          requestedLocks.push(name);
          return callback();
        },
      },
    },
  });
  globalThis.fetch = (async () =>
    jsonResponse({
      ok: true,
      data: { refreshed: true, recoveredAccess: false },
    })) as typeof fetch;

  try {
    assert.deepEqual(await refreshApiSession(), {
      status: "refreshed",
      recoveredAccess: false,
    });
    assert.deepEqual(requestedLocks, [AUTH_SESSION_CLIENT_LOCK_NAME]);
  } finally {
    if (originalNavigator) {
      Object.defineProperty(globalThis, "navigator", originalNavigator);
    } else {
      Reflect.deleteProperty(globalThis, "navigator");
    }
  }
});
