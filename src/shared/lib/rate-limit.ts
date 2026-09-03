import { ApplicationError } from "./application-error";
import { prisma } from "./prisma";

type RateLimitInput = {
  key: string;
  limit: number;
  windowMs: number;
};

export const createRateLimitError = (retryAfterSeconds: number) =>
  new ApplicationError(
    "RATE_LIMITED",
    "Too many requests. Try again later.",
    429,
    { retryAfterSeconds },
    { "Retry-After": String(retryAfterSeconds) },
  );

export async function consumeRateLimit({ key, limit, windowMs }: RateLimitInput) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + windowMs);

  return prisma.$transaction(async (tx) => {
    const current = await tx.abuseCounter.findUnique({ where: { key } });

    if (!current || current.expiresAt <= now) {
      await tx.abuseCounter.upsert({
        where: { key },
        update: { count: 1, windowStartedAt: now, expiresAt },
        create: { key, count: 1, windowStartedAt: now, expiresAt },
      });

      return { allowed: true, remaining: Math.max(0, limit - 1), retryAfterMs: 0 };
    }

    if (current.count >= limit) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: Math.max(1000, current.expiresAt.getTime() - now.getTime()),
      };
    }

    const updated = await tx.abuseCounter.update({
      where: { key },
      data: { count: { increment: 1 } },
    });

    return {
      allowed: true,
      remaining: Math.max(0, limit - updated.count),
      retryAfterMs: 0,
    };
  });
}

export async function enforceRateLimit(input: RateLimitInput) {
  const result = await consumeRateLimit(input);
  if (!result.allowed) {
    const retryAfterSeconds = Math.ceil(result.retryAfterMs / 1000);
    throw createRateLimitError(retryAfterSeconds);
  }

  return result;
}
