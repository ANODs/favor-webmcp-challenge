import { confirmTonSubscriptionPayment } from "@/features/favor-subscription/server";
import { handleRouteError, ok } from "@/shared/lib/api";
import { requireUser } from "@/shared/lib/auth";

export async function POST(request: Request) {
  try {
    const payer = await requireUser();
    const result = await confirmTonSubscriptionPayment({
      payerUserId: payer.id,
      input: await request.json(),
    });

    return ok(result);
  } catch (error) {
    console.error("[api/subscription/ton/confirm] failed", error);
    return handleRouteError(error);
  }
}
