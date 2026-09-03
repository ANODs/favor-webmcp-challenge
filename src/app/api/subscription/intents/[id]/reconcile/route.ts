import { reconcileOnchainSubscriptionPayment } from "@/features/favor-subscription/server";
import { handleRouteError, ok } from "@/shared/lib/api";
import { requireUser } from "@/shared/lib/auth";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const payer = await requireUser();
    const { id } = await params;

    return ok(await reconcileOnchainSubscriptionPayment({
      intentId: id,
      payerUserId: payer.id,
    }));
  } catch (error) {
    return handleRouteError(error);
  }
}
