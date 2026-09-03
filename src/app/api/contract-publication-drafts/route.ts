import { z } from "zod";

import { prepareContractPublicationDraft } from "@/features/create-contract/server";
import { env } from "@/shared/config/env";
import { handleRouteError, ok } from "@/shared/lib/api";
import { getCurrentUser } from "@/shared/lib/auth";
import { enforceRateLimit } from "@/shared/lib/rate-limit";
import { hashRequestIp } from "@/shared/lib/request-ip";

const requestSchema = z.object({ data: z.unknown() });
const MAX_DRAFT_REQUEST_BYTES = 150_000;

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (contentLength > MAX_DRAFT_REQUEST_BYTES) {
      return Response.json(
        {
          ok: false,
          error: "Publication draft is too large.",
          details: { code: "PUBLICATION_DRAFT_TOO_LARGE" },
        },
        { status: 413 },
      );
    }

    const ipHash = hashRequestIp(request);
    await Promise.all([
      enforceRateLimit({
        key: `contract-publication-draft:burst:${ipHash}`,
        limit: 10,
        windowMs: 10 * 60 * 1000,
      }),
      enforceRateLimit({
        key: `contract-publication-draft:day:${ipHash}`,
        limit: 50,
        windowMs: 24 * 60 * 60 * 1000,
      }),
    ]);

    const { data } = requestSchema.parse(await request.json());
    const user = await getCurrentUser();
    const preparedDraft = await prepareContractPublicationDraft({
      botUsername: env.telegramBotUsername,
      data,
      ownerUserId: user?.id && user.id > 0 ? user.id : null,
    });

    return ok(preparedDraft, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
