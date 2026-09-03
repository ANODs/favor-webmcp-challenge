import { getSubscriptionOffer } from "@/features/favor-subscription/server";
import { handleRouteError, ok } from "@/shared/lib/api";

export async function GET() {
  try {
    return ok(await getSubscriptionOffer());
  } catch (error) {
    console.error("[api/subscription/offer] failed", error);
    return handleRouteError(error);
  }
}
