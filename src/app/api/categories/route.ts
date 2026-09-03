import { getCategoriesWithRelevance } from "@/entities/category/server";
import { handleRouteError, ok } from "@/shared/lib/api";
import { getCurrentUser } from "@/shared/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();
    const categories = await getCategoriesWithRelevance(user?.id);
    return ok({ categories });
  } catch (error) {
    return handleRouteError(error);
  }
}
