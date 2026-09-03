import { parseModeratedUsersCursor } from "@/entities/user";
import {
  listUsersForModeration,
  requireModeratorCapability,
} from "@/entities/user/server";
import { handleRouteError, ok } from "@/shared/lib/api";

export async function GET(request: Request) {
  try {
    await requireModeratorCapability();
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") ?? "";
    const cursor = parseModeratedUsersCursor(searchParams.get("cursor"));
    const users = await listUsersForModeration(query, cursor);

    return ok(users);
  } catch (error) {
    return handleRouteError(error);
  }
}
