import { completeCurrentUserOnboarding } from "@/entities/user/server";
import { handleRouteError, ok } from "@/shared/lib/api";
import { requireUser } from "@/shared/lib/auth";
import { assertSameOriginJsonRequest } from "@/shared/lib/request-security";
import { withTelegramAvatar } from "@/shared/lib/telegram/avatar";

export async function PATCH(request: Request) {
  try {
    assertSameOriginJsonRequest(request);
    const user = await requireUser();
    const updatedUser = await completeCurrentUserOnboarding(user);

    return ok(withTelegramAvatar(updatedUser));
  } catch (error) {
    return handleRouteError(error);
  }
}
