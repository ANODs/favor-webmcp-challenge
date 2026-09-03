import { cookies } from "next/headers";

import { fail, handleRouteError, ok } from "@/shared/lib/api";
import {
  clearFailedAuthSessionRefreshCookies,
  getRefreshableAuthSession,
  setRefreshedAuthSessionCookies,
} from "@/shared/lib/auth";
import { readActiveAuthSessionId } from "@/shared/lib/auth-session-cookie";
import { ApplicationError } from "@/shared/lib/application-error";
import { enforceRateLimit } from "@/shared/lib/rate-limit";
import { hashRequestIp } from "@/shared/lib/request-ip";
import { assertSameOriginJsonRequest } from "@/shared/lib/request-security";

const REFRESH_RATE_LIMIT_WINDOW_MS = 60 * 1000;

export async function POST(request: Request) {
  try {
    assertSameOriginJsonRequest(request);
    const cookieStore = await cookies();
    const activeSessionId = readActiveAuthSessionId(cookieStore);
    await enforceRateLimit({
      key: activeSessionId
        ? `auth:session:refresh:${activeSessionId}`
        : `auth:session:refresh:ip:${hashRequestIp(request)}`,
      limit: activeSessionId ? 30 : 120,
      windowMs: REFRESH_RATE_LIMIT_WINDOW_MS,
    });
    const refreshableSession = await getRefreshableAuthSession();

    if (!refreshableSession) {
      return clearFailedAuthSessionRefreshCookies(
        fail("Authentication required.", 401, { code: "AUTH_SESSION_EXPIRED" }),
      );
    }

    return setRefreshedAuthSessionCookies(
      ok({
        refreshed: true,
        recoveredAccess: refreshableSession.recoveredAccess,
      }),
      refreshableSession,
    );
  } catch (error) {
    if (error instanceof ApplicationError) {
      return handleRouteError(error);
    }
    console.error("[api/auth/session/refresh] failed", error);
    return fail(
      "Session refresh is temporarily unavailable.",
      503,
      { code: "AUTH_SESSION_REFRESH_UNAVAILABLE" },
    );
  }
}
