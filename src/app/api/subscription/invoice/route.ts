import { prepareTelegramSubscriptionInvoice } from "@/features/favor-subscription/server";
import { handleRouteError, ok } from "@/shared/lib/api";
import { requireUser } from "@/shared/lib/auth";

export async function POST(request: Request) {
  try {
    const payer = await requireUser();
    const result = await prepareTelegramSubscriptionInvoice({
      payer,
      input: await request.json(),
    });

    return ok(result);
  } catch (error) {
    console.error("[api/subscription/invoice] failed", error);
    return handleRouteError(error);
  }
}
