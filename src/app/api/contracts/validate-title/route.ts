import { z } from "zod";

import { handleRouteError, ok } from "@/shared/lib/api";
import { moderateContractContent } from "@/entities/contract";
import { enforceRateLimit } from "@/shared/lib/rate-limit";
import { hashRequestIp } from "@/shared/lib/request-ip";
import { validateContractTitle } from "@/shared/lib/slug";
import { CONTRACT_TITLE_VALIDATION_CODES } from "@/shared/config";

const schema = z.object({
  title: z.string(),
});

export async function POST(request: Request) {
  try {
    await enforceRateLimit({
      key: `contract:validate-title:minute:${hashRequestIp(request)}`,
      limit: 30,
      windowMs: 60 * 1000,
    });
    const { title } = schema.parse(await request.json());
    const moderation = moderateContractContent({ title });

    if (moderation.isBlocked) {
      return ok({
        ok: false as const,
        code: CONTRACT_TITLE_VALIDATION_CODES.contentBlocked,
      });
    }

    const result = validateContractTitle(title);

    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
