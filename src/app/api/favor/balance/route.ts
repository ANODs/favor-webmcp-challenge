import { z } from "zod";

import { handleRouteError, ok } from "@/shared/lib/api";
import { requireUser } from "@/shared/lib/auth";
import { safeParseAddress } from "@/shared/lib/ton";
import { getFavorBalanceNano } from "@/features/category-auction/server";

const querySchema = z.object({ owner: z.string().min(1) });

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { owner } = querySchema.parse({ owner: new URL(request.url).searchParams.get("owner") });
    if (!user.walletAddress || !safeParseAddress(user.walletAddress).equals(safeParseAddress(owner))) {
      throw new Error("WALLET_DOES_NOT_MATCH_ACCOUNT");
    }
    const balanceNano = await getFavorBalanceNano(owner);
    return ok({ balanceNano: balanceNano.toString(), decimals: 9 });
  } catch (error) {
    return handleRouteError(error);
  }
}
