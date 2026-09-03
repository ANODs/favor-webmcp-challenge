import { cookies } from "next/headers";

import { getActiveAccountRestrictions } from "@/entities/user/server";
import { fail, handleRouteError, ok } from "@/shared/lib/api";
import { getCurrentUser, syncCurrentUserFromTelegramInitData } from "@/shared/lib/auth";
import { hasRefreshableAuthSessionCookie } from "@/shared/lib/auth-session-cookie";
import { withTelegramAvatar } from "@/shared/lib/telegram/avatar";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const currentUser = await getCurrentUser();
    const user = await syncCurrentUserFromTelegramInitData(
      currentUser,
      request.headers.get("X-Telegram-Init-Data"),
    );
    console.info("[api/auth/me] current user resolved", {
      hasUser: Boolean(user),
      userId: user?.id ?? null,
      role: user?.role ?? null,
    });

    if (!user) {
      const cookieStore = await cookies();
      if (hasRefreshableAuthSessionCookie(cookieStore)) {
        return fail("Session renewal is required.", 401, {
          code: "AUTH_SESSION_REQUIRED",
        });
      }

      return ok(null);
    }

    const accountRestrictions =
      user.id === 0
        ? []
        : await getActiveAccountRestrictions(user.id).then((restrictions) =>
            restrictions.map((restriction) => ({
              id: restriction.id,
              scope: restriction.scope,
              publicMessage: restriction.publicMessage,
              reasonCode: restriction.reasonCode,
              expiresAt: restriction.expiresAt,
            })),
          );

    return ok({
      ...withTelegramAvatar(user),
      accountRestrictions,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
