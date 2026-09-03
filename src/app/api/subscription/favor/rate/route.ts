import { getFavorSubscriptionRate } from "@/features/favor-subscription/server";
import { handleRouteError, ok } from "@/shared/lib/api";

export async function GET() {
  try {
    return ok(await getFavorSubscriptionRate());
  } catch (error) {
    return handleRouteError(error);
  }
}
