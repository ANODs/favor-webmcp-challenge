import { z } from "zod";

import { requireUserCapability } from "@/entities/user/server";
import { handleRouteError, ok } from "@/shared/lib/api";
import { prisma } from "@/shared/lib/prisma";
import { enforceRateLimit } from "@/shared/lib/rate-limit";

import { toPortfolioCase, portfolioCaseSelect } from "@/entities/portfolio-case";

const createCaseSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(2000).nullable().optional(),
  telegramPostUrl: z.string().url().nullable().optional(),
  links: z
    .array(
      z.object({
        url: z.string().url(),
        label: z.string().max(100).optional(),
      })
    )
    .max(10)
    .nullable()
    .optional(),
  contractId: z.number().int().positive().nullable().optional(),
});

export async function POST(request: Request) {
  try {
    const user = await requireUserCapability("account:write");
    await enforceRateLimit({
      key: `portfolio:create:hour:${user.id}`,
      limit: 5,
      windowMs: 60 * 60 * 1000,
    });

    const payload = createCaseSchema.parse(await request.json());

    if (payload.contractId) {
      const contract = await prisma.contract.findUnique({
        where: { id: payload.contractId },
      });
      if (!contract) {
        throw new Error("Contract not found");
      }
    }

    const newCase = await prisma.portfolioCase.create({
      data: {
        userId: user.id,
        title: payload.title,
        description: payload.description,
        telegramPostUrl: payload.telegramPostUrl,
        links: payload.links ?? [],
        contractId: payload.contractId,
      },
      select: portfolioCaseSelect,
    });

    return ok(toPortfolioCase(newCase));
  } catch (error) {
    return handleRouteError(error);
  }
}
