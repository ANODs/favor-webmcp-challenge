import type { TelegramBotAccessSubject } from "@/entities/user/server";

import type { InitiateContractDealInput } from "./initiate-contract-deal";

export type InitiateContractDealServerInput = Omit<
  InitiateContractDealInput,
  "expectedAuthorId"
> & {
  telegramUserId: bigint;
};

export type ContractAuthorTelegramIdentity = {
  userId: number;
  telegramUserId: bigint;
};

export type InitiateContractDealServerDependencies<TResult> = {
  findContractAuthorTelegramIdentity: (
    slug: string,
  ) => Promise<ContractAuthorTelegramIdentity | null>;
  assertTelegramBotWriteAccess: (
    telegramUserId: bigint,
    subject?: TelegramBotAccessSubject,
  ) => Promise<void>;
  initiate: (input: InitiateContractDealInput) => Promise<TResult>;
};

export async function initiateContractDealWithServerDependencies<TResult>(
  { telegramUserId, ...input }: InitiateContractDealServerInput,
  dependencies: InitiateContractDealServerDependencies<TResult>,
) {
  const author =
    await dependencies.findContractAuthorTelegramIdentity(input.slug);

  if (author === null) {
    throw new Error("NOT_FOUND");
  }

  const actorAccessCheck =
    dependencies.assertTelegramBotWriteAccess(telegramUserId);
  const authorAccessCheck =
    author.telegramUserId === telegramUserId
      ? Promise.resolve()
      : dependencies.assertTelegramBotWriteAccess(
          author.telegramUserId,
          "contract_author",
        );
  const [actorAccess, authorAccess] = await Promise.allSettled([
    actorAccessCheck,
    authorAccessCheck,
  ]);

  if (actorAccess.status === "rejected") {
    throw actorAccess.reason;
  }

  if (authorAccess.status === "rejected") {
    throw authorAccess.reason;
  }

  return dependencies.initiate({
    ...input,
    expectedAuthorId: author.userId,
  });
}
