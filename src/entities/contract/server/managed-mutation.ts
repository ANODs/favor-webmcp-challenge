import { Prisma, type Contract } from "@prisma/client";

import { canManageContract } from "../model/scouting";

type ContractManager = {
  id: number;
  role?: string | null;
};

type LockedContractMutationResult<T> =
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "ok"; data: T };

type TelegramIdCarrier = {
  telegramId?: unknown;
};

type ContractMutationResponseShape = {
  author?: TelegramIdCarrier | null;
  scout?: TelegramIdCarrier | null;
};

const omitTelegramId = <T extends TelegramIdCarrier>(participant: T) => {
  const safeParticipant = { ...participant };
  delete safeParticipant.telegramId;

  return safeParticipant;
};

export const serializeContractMutationResponse = <
  T extends ContractMutationResponseShape,
>(
  contract: T,
) => ({
  ...contract,
  ...(contract.author === undefined
    ? {}
    : {
        author: contract.author ? omitTelegramId(contract.author) : null,
      }),
  ...(contract.scout === undefined
    ? {}
    : {
        scout: contract.scout ? omitTelegramId(contract.scout) : null,
      }),
});

export const rethrowContractManagementWriteError = (error: unknown): never => {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  ) {
    throw new Error("FORBIDDEN");
  }

  throw error;
};

export async function withLockedManagedContract<T>(
  tx: Prisma.TransactionClient,
  {
    slug,
    user,
  }: {
    slug: string;
    user: ContractManager;
  },
  mutation: (contract: Contract) => Promise<T>,
): Promise<LockedContractMutationResult<T>> {
  await tx.$queryRaw<Array<{ id: number }>>(
    Prisma.sql`
      SELECT "id"
      FROM "Contract"
      WHERE "slug" = ${slug}
      FOR UPDATE
    `,
  );

  const contract = await tx.contract.findUnique({ where: { slug } });

  if (!contract) {
    return { status: "not_found" };
  }

  if (!canManageContract(contract, user)) {
    return { status: "forbidden" };
  }

  return { status: "ok", data: await mutation(contract) };
}
