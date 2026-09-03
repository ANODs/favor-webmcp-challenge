import { z } from "zod";

import { handleRouteError, ok } from "@/shared/lib/api";
import { enforceRateLimit } from "@/shared/lib/rate-limit";
import { hashRequestIp } from "@/shared/lib/request-ip";
import { ensureUniqueSlug } from "@/shared/lib/slug";

const schema = z.object({
  title: z.string(),
  excludeId: z.number().int().positive().optional(),
});

export async function POST(request: Request) {
  try {
    await enforceRateLimit({
      key: `contract:generate-slug:minute:${hashRequestIp(request)}`,
      limit: 30,
      windowMs: 60 * 1000,
    });
    const { title, excludeId } = schema.parse(await request.json());
    const result = await ensureUniqueSlug(title, excludeId);

    if (!result.ok) {
      throw new Error(result.reason);
    }

    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
