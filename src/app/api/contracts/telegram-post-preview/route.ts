import { z } from "zod";

import { translateTelegramPostForContract } from "@/features/create-contract/server";
import { handleRouteError, ok } from "@/shared/lib/api";
import { getCurrentUser } from "@/shared/lib/auth";
import { enforceRateLimit } from "@/shared/lib/rate-limit";
import { hashRequestIp } from "@/shared/lib/request-ip";
import { fetchTelegramPostPreview } from "@/shared/lib/telegram/server";

const schema = z.object({
  telegramPostUrl: z.string().url(),
});

export async function POST(request: Request) {
  try {
    await enforceRateLimit({
      key: `contract:telegram-preview:minute:${hashRequestIp(request)}`,
      limit: 20,
      windowMs: 60 * 1000,
    });
    const { telegramPostUrl } = schema.parse(await request.json());
    const [preview, user] = await Promise.all([
      fetchTelegramPostPreview(telegramPostUrl, { signal: request.signal }),
      getCurrentUser(),
    ]);

    if (!user?.isPremium) {
      return ok(preview);
    }

    try {
      const translation = await translateTelegramPostForContract(
        preview.description,
        { signal: request.signal },
      );

      return ok({ ...preview, translation });
    } catch (error) {
      if (
        request.signal.aborted ||
        (error instanceof Error && error.name === "AbortError")
      ) {
        throw error;
      }
      console.error("[contract-translation] Telegram post translation failed", {
        userId: user.id,
        error,
      });
    }

    return ok(preview);
  } catch (error) {
    return handleRouteError(error);
  }
}
