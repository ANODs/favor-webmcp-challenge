import { env } from "@/shared/config/env";
import { handleRouteError, fail, ok } from "@/shared/lib/api";
import {
  getOrCreateDevSessionUser,
  startAuthSession,
} from "@/shared/lib/auth";

export async function POST() {
  try {
    if (!env.enableDevSessionAuth) {
      return fail("Dev session auth is disabled.", 404);
    }

    const user = await getOrCreateDevSessionUser();

    if (!user) {
      return fail("Failed to create the development session.", 500);
    }

    const response = ok(user);

    return await startAuthSession(response, {
      userId: user.id,
      role: user.role,
      telegramId: user.telegramId.toString(),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function GET() {
  return POST();
}
