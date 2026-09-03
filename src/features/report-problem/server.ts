import { randomBytes } from "node:crypto";
import { z } from "zod";

import { prisma } from "@/shared/lib/prisma";

const primitiveSchema = z.union([
  z.string().max(500),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);

const metadataSchema = z
  .record(z.string().max(64), primitiveSchema)
  .refine((value) => Object.keys(value).length <= 24, "Too many metadata fields");

const breadcrumbSchema = z.object({
  timestamp: z.iso.datetime(),
  category: z.enum(["action", "api", "navigation", "story", "system"]),
  name: z.string().min(1).max(120),
  outcome: z.enum(["started", "success", "failure", "info"]).optional(),
  metadata: metadataSchema.optional(),
});

export const clientDiagnosticReportSchema = z.object({
  id: z.string().min(8).max(100),
  code: z.string().regex(/^[A-Z0-9_]{1,64}$/),
  fingerprint: z.string().regex(/^[A-Z0-9]{4,32}$/),
  area: z.string().regex(/^[a-z0-9_-]{1,64}$/),
  message: z.string().min(1).max(2_000),
  stack: z.string().max(5_000).optional(),
  timestamp: z.iso.datetime(),
  route: z
    .string()
    .max(500)
    .transform((value) => value.split(/[?#]/, 1)[0])
    .optional(),
  locale: z.enum(["ru", "en"]),
  context: metadataSchema,
  breadcrumbs: z.array(breadcrumbSchema).max(20),
});

type SaveClientDiagnosticReportInput = {
  userId: number;
  reporterTelegramId: bigint;
  report: unknown;
};

export async function saveClientDiagnosticReport({
  userId,
  reporterTelegramId,
  report,
}: SaveClientDiagnosticReportInput) {
  const payload = clientDiagnosticReportSchema.parse(report);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const publicId = randomBytes(12).toString("base64url");

  const [, stored] = await prisma.$transaction([
    prisma.clientDiagnosticReport.deleteMany({
      where: {
        expiresAt: { lt: now },
        supportTicket: { is: null },
      },
    }),
    prisma.clientDiagnosticReport.create({
      data: {
        publicId,
        userId,
        reporterTelegramId,
        code: payload.code,
        source: payload.area,
        fingerprint: payload.fingerprint,
        payload,
        expiresAt,
      },
      select: { publicId: true, expiresAt: true },
    }),
  ]);

  return stored;
}
