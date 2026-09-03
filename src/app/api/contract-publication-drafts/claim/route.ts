import { z } from "zod";

import { requireTelegramUser } from "@/entities/user/server";
import { claimContractPublicationDraft } from "@/features/create-contract/server";
import { handleRouteError, ok } from "@/shared/lib/api";

const requestSchema = z.object({
  token: z.string().trim().min(20).max(64),
});

export async function POST(request: Request) {
  try {
    const user = await requireTelegramUser(request);
    const { token } = requestSchema.parse(await request.json());
    const draft = await claimContractPublicationDraft({ token, userId: user.id });

    return ok(draft);
  } catch (error) {
    return handleRouteError(error);
  }
}
