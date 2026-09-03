import { recordDiagnosticBreadcrumb } from "@/shared/lib/client-diagnostics";
import type { ApiEnvelope } from "@/shared/types/api";

import { withAuthSessionClientLock } from "./auth-session-lock";

const TELEGRAM_INIT_DATA_STORAGE_KEY = "favor.telegram.initData";
const AUTH_SESSION_REFRESH_PATH = "/api/auth/session/refresh";
const AUTH_SESSION_REFRESH_RETRY_DELAY_MS = 250;
const AUTH_SESSION_REFRESH_MAX_ATTEMPTS = 2;

type RequestOptions<TApi, TDto> = {
  path: string;
  init?: RequestInit;
  mapDto?: (data: TApi) => TDto;
};

export type AuthSessionRefreshOutcome =
  | { status: "refreshed"; recoveredAccess: boolean }
  | { status: "expired" }
  | { status: "unavailable" };

let devSessionBootstrapPromise: Promise<void> | null = null;
let authSessionRefreshPromise: Promise<AuthSessionRefreshOutcome> | null = null;

export class ApiRequestError extends Error {
  details?: unknown;
  status?: number;
  code?: string;

  constructor(
    message: string,
    details?: unknown,
    options: { status?: number; code?: string; cause?: unknown } = {},
  ) {
    super(message);
    this.name = "ApiRequestError";
    this.details = details;
    this.status = options.status;
    this.code = options.code;
    if (options.cause !== undefined) this.cause = options.cause;
  }
}

const getRequestPath = (path: string) => {
  try {
    return new URL(path, typeof window === "undefined" ? "http://localhost" : window.location.origin)
      .pathname;
  } catch {
    return path.split("?", 1)[0].slice(0, 300);
  }
};

const getApiErrorCode = (details: unknown) => {
  if (!details || typeof details !== "object" || !("code" in details)) return undefined;
  return typeof details.code === "string" ? details.code : undefined;
};

const isDevSessionEnabled = () =>
  typeof window !== "undefined" &&
  process.env.NEXT_PUBLIC_ENABLE_DEV_SESSION_AUTH === "true";

const resolveTelegramInitData = () => {
  if (typeof window === "undefined") {
    return null;
  }

  const webAppInitData = window.Telegram?.WebApp?.initData?.trim();

  if (webAppInitData) {
    sessionStorage.setItem(TELEGRAM_INIT_DATA_STORAGE_KEY, webAppInitData);
    return webAppInitData;
  }

  return sessionStorage.getItem(TELEGRAM_INIT_DATA_STORAGE_KEY)?.trim() || null;
};

const ensureDevSessionAuthorized = async () => {
  if (!isDevSessionEnabled()) return;

  if (!devSessionBootstrapPromise) {
    devSessionBootstrapPromise = withAuthSessionClientLock(() =>
      fetch("/api/dev/session", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      }).then(async (response) => {
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as
            | { error?: string; details?: unknown }
            | null;
          throw new ApiRequestError(
            body?.error ?? "Failed to initialize the development session.",
            body?.details,
          );
        }
      }),
    )
      .catch((error) => {
        devSessionBootstrapPromise = null;
        throw error;
      });
  }

  await devSessionBootstrapPromise;
};

type AuthSessionRefreshAttempt = {
  outcome: AuthSessionRefreshOutcome;
  retryable: boolean;
};

const performAuthSessionRefreshAttempt = async (
  attempt: number,
): Promise<AuthSessionRefreshAttempt> => {
  try {
    const response = await fetch(AUTH_SESSION_REFRESH_PATH, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    recordDiagnosticBreadcrumb({
      category: "api",
      name: `POST ${AUTH_SESSION_REFRESH_PATH}`,
      outcome: response.ok ? "success" : "failure",
      metadata: { status: response.status, attempt },
    });

    const body = (await response.json().catch(() => null)) as
      | ApiEnvelope<{ refreshed?: boolean; recoveredAccess?: boolean }>
      | null;

    if (response.ok && body?.ok && body.data.refreshed === true) {
      return {
        outcome: {
          status: "refreshed",
          recoveredAccess: body.data.recoveredAccess === true,
        },
        retryable: false,
      };
    }

    return {
      outcome:
        response.status === 401
          ? { status: "expired" }
          : { status: "unavailable" },
      retryable: response.status === 503,
    };
  } catch {
    recordDiagnosticBreadcrumb({
      category: "api",
      name: `POST ${AUTH_SESSION_REFRESH_PATH}`,
      outcome: "failure",
      metadata: { reason: "network", attempt },
    });
    return {
      outcome: { status: "unavailable" },
      retryable: true,
    };
  }
};

const refreshApiSessionWithRetry = async () => {
  for (let attempt = 1; attempt <= AUTH_SESSION_REFRESH_MAX_ATTEMPTS; attempt += 1) {
    const result = await performAuthSessionRefreshAttempt(attempt);
    if (!result.retryable || attempt === AUTH_SESSION_REFRESH_MAX_ATTEMPTS) {
      return result.outcome;
    }

    await new Promise<void>((resolve) => {
      globalThis.setTimeout(resolve, AUTH_SESSION_REFRESH_RETRY_DELAY_MS);
    });
  }

  return { status: "unavailable" } as const;
};

export async function refreshApiSession() {
  await ensureDevSessionAuthorized();

  if (!authSessionRefreshPromise) {
    authSessionRefreshPromise = withAuthSessionClientLock(() =>
      refreshApiSessionWithRetry(),
    );
  }

  const pendingRefresh = authSessionRefreshPromise;
  try {
    return await pendingRefresh;
  } finally {
    if (authSessionRefreshPromise === pendingRefresh) {
      authSessionRefreshPromise = null;
    }
  }
}

export async function apiRequest<TApi, TDto = TApi>({
  path,
  init,
  mapDto,
}: RequestOptions<TApi, TDto>): Promise<TDto> {
  await ensureDevSessionAuthorized();
  const telegramInitData = resolveTelegramInitData();
  const method = init?.method?.toUpperCase() ?? "GET";
  const requestPath = getRequestPath(path);

  recordDiagnosticBreadcrumb({
    category: "api",
    name: `${method} ${requestPath}`,
    outcome: "started",
  });

  let response: Response;
  let body: ApiEnvelope<TApi> | null;
  try {
    const executeRequest = () =>
      fetch(path, {
        credentials: "include",
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...(telegramInitData ? { "X-Telegram-Init-Data": telegramInitData } : {}),
          ...(init?.headers ?? {}),
        },
      });

    response = await executeRequest();
    body = (await response.json().catch(() => null)) as ApiEnvelope<TApi> | null;

    const responseErrorCode =
      body && !body.ok ? getApiErrorCode(body.details) : undefined;
    if (
      response.status === 401 &&
      responseErrorCode === "AUTH_SESSION_REQUIRED" &&
      requestPath !== AUTH_SESSION_REFRESH_PATH
    ) {
      const refreshOutcome = await refreshApiSession();
      if (refreshOutcome.status === "refreshed") {
        response = await executeRequest();
        body = (await response.json().catch(() => null)) as ApiEnvelope<TApi> | null;
      } else if (refreshOutcome.status === "unavailable") {
        throw new ApiRequestError(
          "Session renewal is temporarily unavailable.",
          { code: "AUTH_SESSION_REFRESH_UNAVAILABLE" },
          { status: 503, code: "AUTH_SESSION_REFRESH_UNAVAILABLE" },
        );
      }
    }
  } catch (error) {
    if (error instanceof ApiRequestError) {
      throw error;
    }
    if (init?.signal?.aborted || (error instanceof Error && error.name === "AbortError")) {
      throw error;
    }
    recordDiagnosticBreadcrumb({
      category: "api",
      name: `${method} ${requestPath}`,
      outcome: "failure",
      metadata: { reason: "network" },
    });
    throw new ApiRequestError("Network request failed.", undefined, {
      code: "NETWORK_REQUEST_FAILED",
      cause: error,
    });
  }

  if (!response.ok || !body?.ok) {
    const details = body && !body.ok ? body.details : undefined;
    const code = getApiErrorCode(details) ?? `HTTP_${response.status}`;
    recordDiagnosticBreadcrumb({
      category: "api",
      name: `${method} ${requestPath}`,
      outcome: "failure",
      metadata: { status: response.status, code },
    });
    throw new ApiRequestError(
      body && !body.ok ? body.error : `API request failed: ${response.status}`,
      details,
      { status: response.status, code },
    );
  }

  recordDiagnosticBreadcrumb({
    category: "api",
    name: `${method} ${requestPath}`,
    outcome: "success",
    metadata: { status: response.status },
  });

  return mapDto ? mapDto(body.data) : (body.data as unknown as TDto);
}
