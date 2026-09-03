import { Prisma } from "@prisma/client";

export const isDatabaseUnavailableError = (error: unknown) =>
  error instanceof Prisma.PrismaClientInitializationError ||
  (error instanceof Error &&
    (error.message.includes("Can't reach database server") ||
      error.message.includes("ECONNREFUSED") ||
      error.message.includes("P1001")));
