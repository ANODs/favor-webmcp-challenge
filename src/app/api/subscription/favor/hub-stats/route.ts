import { getFavorHubStats } from "@/features/favor-subscription/server";
import { handleRouteError, ok } from "@/shared/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return ok(await getFavorHubStats());
  } catch (error) {
    console.error("[api/subscription/favor/hub-stats] failed", error);
    return handleRouteError(error);
  }
}
