import {
  cancelSubscriptionIntent,
  getSubscriptionIntentStatus,
} from "@/features/favor-subscription/server";
import { handleRouteError, ok } from "@/shared/lib/api";
import { requireUser } from "@/shared/lib/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const payer = await requireUser();
    const { id } = await params;

    return ok(await getSubscriptionIntentStatus({
      intentId: id,
      payerUserId: payer.id,
    }));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const payer = await requireUser();
    const { id } = await params;

    return ok(await cancelSubscriptionIntent({
      intentId: id,
      payerUserId: payer.id,
    }));
  } catch (error) {
    return handleRouteError(error);
  }
}
