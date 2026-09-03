import { cookies } from "next/headers";

import {
  SEARCH_HISTORY_REQUEST_MAX_BYTES,
  deleteSearchHistorySchema,
  recordSearchEventSchema,
  searchHistoryListQuerySchema,
} from "@/entities/search-history";
import {
  deleteUserSearchHistory,
  getUserSearchHistory,
  saveSearchEvent,
} from "@/entities/search-history/server";
import { handleRouteError, ok } from "@/shared/lib/api";
import { ApplicationError } from "@/shared/lib/application-error";
import { getCurrentUser } from "@/shared/lib/auth";
import { hasRefreshableAuthSessionCookie } from "@/shared/lib/auth-session-cookie";
import { enforceRateLimit } from "@/shared/lib/rate-limit";
import { hashRequestIp } from "@/shared/lib/request-ip";
import { assertSameOriginJsonRequest } from "@/shared/lib/request-security";

export const runtime = "nodejs";

const SEARCH_HISTORY_RATE_LIMIT_WINDOW_MS = 60 * 1000;

const readBoundedJsonBody = async (request: Request): Promise<unknown> => {
  const contentLengthHeader = request.headers.get("content-length");
  const contentLength = contentLengthHeader
    ? Number(contentLengthHeader)
    : null;

  if (
    contentLength !== null &&
    Number.isFinite(contentLength) &&
    contentLength > SEARCH_HISTORY_REQUEST_MAX_BYTES
  ) {
    throw new ApplicationError(
      "SEARCH_HISTORY_REQUEST_TOO_LARGE",
      "Search history request is too large.",
      413,
    );
  }

  const reader = request.body?.getReader();
  const decoder = new TextDecoder();
  let byteLength = 0;
  let text = "";

  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      byteLength += value.byteLength;
      if (byteLength > SEARCH_HISTORY_REQUEST_MAX_BYTES) {
        await reader.cancel();
        throw new ApplicationError(
          "SEARCH_HISTORY_REQUEST_TOO_LARGE",
          "Search history request is too large.",
          413,
        );
      }

      text += decoder.decode(value, { stream: true });
    }

    text += decoder.decode();
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ApplicationError(
      "INVALID_JSON",
      "Request body must contain valid JSON.",
      400,
    );
  }
};

const getPersistedUserId = async () => {
  const user = await getCurrentUser();
  if (user?.id && user.id > 0) {
    return user.id;
  }

  if (!user) {
    const cookieStore = await cookies();
    if (hasRefreshableAuthSessionCookie(cookieStore)) {
      throw new ApplicationError(
        "AUTH_SESSION_REQUIRED",
        "Session renewal is required.",
        401,
      );
    }
  }

  return null;
};

const assertExpectedUser = (
  userId: number | null,
  expectedUserId: number,
) => {
  if (!userId) {
    throw new ApplicationError(
      "AUTH_SESSION_REQUIRED",
      "Authentication required.",
      401,
    );
  }

  if (userId !== expectedUserId) {
    throw new ApplicationError(
      "SEARCH_HISTORY_ACCOUNT_CHANGED",
      "The active account changed before search history was synchronized.",
      409,
    );
  }

  return userId;
};

const enforceSearchHistoryMutationRateLimit = async (
  request: Request,
  userId: number | null,
  operation: "record" | "delete",
) => {
  const checks = [
    enforceRateLimit({
      key: `search-history:${operation}:ip:${hashRequestIp(request)}`,
      limit: 240,
      windowMs: SEARCH_HISTORY_RATE_LIMIT_WINDOW_MS,
    }),
  ];

  if (userId) {
    checks.push(
      enforceRateLimit({
        key: `search-history:${operation}:user:${userId}`,
        limit: 120,
        windowMs: SEARCH_HISTORY_RATE_LIMIT_WINDOW_MS,
      }),
    );
  }

  await Promise.all(checks);
};

export async function GET(request: Request) {
  try {
    const input = searchHistoryListQuerySchema.parse({
      expectedUserId: new URL(request.url).searchParams.get("expectedUserId"),
      scope: new URL(request.url).searchParams.get("scope"),
    });
    const userId = assertExpectedUser(
      await getPersistedUserId(),
      input.expectedUserId,
    );

    return ok(await getUserSearchHistory(userId, input.scope), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOriginJsonRequest(request);
    const event = recordSearchEventSchema.parse(
      await readBoundedJsonBody(request),
    );
    const userId = assertExpectedUser(
      await getPersistedUserId(),
      event.expectedUserId,
    );
    await enforceSearchHistoryMutationRateLimit(request, userId, "record");
    const storedEvent = await saveSearchEvent({ event, userId });

    return ok(
      storedEvent,
      {
        status: storedEvent.recorded ? 201 : 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    assertSameOriginJsonRequest(request);
    const input = deleteSearchHistorySchema.parse(
      await readBoundedJsonBody(request),
    );
    const userId = assertExpectedUser(
      await getPersistedUserId(),
      input.expectedUserId,
    );

    await enforceSearchHistoryMutationRateLimit(request, userId, "delete");
    const deletedCount = await deleteUserSearchHistory(userId, input);

    return ok(
      { deletedCount },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
