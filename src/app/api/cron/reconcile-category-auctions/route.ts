import { handleRouteError, ok } from "@/shared/lib/api";
import { reconcileDueCategoryAuctions } from "@/features/category-auction/server";

export async function POST(request: Request) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
      return new Response("Unauthorized", { status: 401 });
    }
    const results = await reconcileDueCategoryAuctions();
    return ok({ processed: results.length });
  } catch (error) {
    return handleRouteError(error);
  }
}
