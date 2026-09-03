import crypto from "node:crypto";
import {
  ContractPublicationDraftStatus,
  Prisma,
  type Contract,
} from "@prisma/client";

import {
  contractInputSchema,
  mapContractFormToCreateDto,
} from "@/entities/contract";
import { ApplicationError } from "@/shared/lib/application-error";
import { prisma } from "@/shared/lib/prisma";
import {
  buildContractPublicationDraftStartParam,
  buildTelegramMiniAppUrl,
  isContractPublicationDraftToken,
} from "@/shared/lib/telegram";

import {
  contractPublicationDraftDataSchema,
  type ClaimedContractPublicationDraftDto,
  type PreparedContractPublicationDraftDto,
} from "./model/publication-draft";

export { translateTelegramPostForContract } from "./server/telegram-post-translation";

const CONTRACT_PUBLICATION_DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

const hashToken = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");

const assertValidToken = (token: string) => {
  const normalizedToken = token.trim();

  if (!isContractPublicationDraftToken(normalizedToken)) {
    throw new ApplicationError(
      "CONTRACT_PUBLICATION_DRAFT_INVALID",
      "The publication draft link is invalid.",
      400,
    );
  }

  return normalizedToken;
};

const assertDraftAvailable = ({
  claimedByUserId,
  expiresAt,
  ownerUserId,
  userId,
}: {
  claimedByUserId: number | null;
  expiresAt: Date;
  ownerUserId: number | null;
  userId: number;
}) => {
  if (expiresAt.getTime() <= Date.now()) {
    throw new ApplicationError(
      "CONTRACT_PUBLICATION_DRAFT_EXPIRED",
      "The publication draft has expired.",
      410,
    );
  }

  if (ownerUserId !== null && ownerUserId !== userId) {
    throw new ApplicationError(
      "CONTRACT_PUBLICATION_DRAFT_OWNER_MISMATCH",
      "Open the Mini App with the Telegram account that prepared this draft.",
      403,
    );
  }

  if (claimedByUserId !== null && claimedByUserId !== userId) {
    throw new ApplicationError(
      "CONTRACT_PUBLICATION_DRAFT_ALREADY_CLAIMED",
      "This publication draft was already opened by another Telegram account.",
      403,
    );
  }
};

export async function prepareContractPublicationDraft({
  botUsername,
  data,
  ownerUserId,
}: {
  botUsername: string;
  data: unknown;
  ownerUserId: number | null;
}): Promise<PreparedContractPublicationDraftDto> {
  const parsedData = contractPublicationDraftDataSchema.parse(data);
  contractInputSchema.parse(mapContractFormToCreateDto(parsedData.form));

  const token = crypto.randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + CONTRACT_PUBLICATION_DRAFT_TTL_MS);

  await prisma.contractPublicationDraft.create({
    data: {
      tokenHash: hashToken(token),
      data: parsedData as unknown as Prisma.InputJsonValue,
      locale: parsedData.locale,
      ownerUserId,
      expiresAt,
    },
  });

  return {
    telegramUrl: buildTelegramMiniAppUrl(
      botUsername,
      buildContractPublicationDraftStartParam(token),
    ),
    expiresAt: expiresAt.toISOString(),
  };
}

export async function claimContractPublicationDraft({
  token,
  userId,
}: {
  token: string;
  userId: number;
}): Promise<ClaimedContractPublicationDraftDto> {
  const normalizedToken = assertValidToken(token);

  return prisma.$transaction(async (tx) => {
    const draft = await tx.contractPublicationDraft.findUnique({
      where: { tokenHash: hashToken(normalizedToken) },
      include: { contract: { select: { slug: true } } },
    });

    if (!draft) {
      throw new ApplicationError(
        "CONTRACT_PUBLICATION_DRAFT_NOT_FOUND",
        "Publication draft not found.",
        404,
      );
    }

    if (
      draft.status === ContractPublicationDraftStatus.published &&
      draft.contract
    ) {
      return {
        status: "published" as const,
        contractSlug: draft.contract.slug,
      };
    }

    assertDraftAvailable({
      claimedByUserId: draft.claimedByUserId,
      expiresAt: draft.expiresAt,
      ownerUserId: draft.ownerUserId,
      userId,
    });

    if (draft.status === ContractPublicationDraftStatus.publishing) {
      throw new ApplicationError(
        "CONTRACT_PUBLICATION_DRAFT_PUBLISHING",
        "The contract is already being published.",
        409,
      );
    }

    if (draft.status === ContractPublicationDraftStatus.prepared) {
      const claim = await tx.contractPublicationDraft.updateMany({
        where: {
          id: draft.id,
          status: ContractPublicationDraftStatus.prepared,
          claimedByUserId: null,
        },
        data: {
          status: ContractPublicationDraftStatus.claimed,
          claimedByUserId: userId,
          claimedAt: new Date(),
        },
      });

      if (claim.count !== 1) {
        throw new ApplicationError(
          "CONTRACT_PUBLICATION_DRAFT_ALREADY_CLAIMED",
          "This publication draft was already opened in another session.",
          409,
        );
      }
    }

    return {
      status: "claimed" as const,
      data: contractPublicationDraftDataSchema.parse(draft.data),
    };
  });
}

export type ResolvedContractPublicationDraft =
  | {
      status: "ready";
      id: string;
    }
  | {
      status: "published";
      contract: Contract;
    };

export async function resolveContractPublicationDraftForPublishing({
  token,
  userId,
}: {
  token: string;
  userId: number;
}): Promise<ResolvedContractPublicationDraft> {
  const normalizedToken = assertValidToken(token);
  const draft = await prisma.contractPublicationDraft.findUnique({
    where: { tokenHash: hashToken(normalizedToken) },
    include: { contract: true },
  });

  if (!draft) {
    throw new ApplicationError(
      "CONTRACT_PUBLICATION_DRAFT_NOT_FOUND",
      "Publication draft not found.",
      404,
    );
  }

  if (
    draft.status === ContractPublicationDraftStatus.published &&
    draft.contract
  ) {
    return { status: "published", contract: draft.contract };
  }

  assertDraftAvailable({
    claimedByUserId: draft.claimedByUserId,
    expiresAt: draft.expiresAt,
    ownerUserId: draft.ownerUserId,
    userId,
  });

  if (
    draft.status !== ContractPublicationDraftStatus.claimed ||
    draft.claimedByUserId !== userId
  ) {
    throw new ApplicationError(
      "CONTRACT_PUBLICATION_DRAFT_NOT_CLAIMED",
      "Open and review the transferred draft in the Mini App first.",
      409,
    );
  }

  return { status: "ready", id: draft.id };
}

export async function reserveContractPublicationDraft(
  tx: Prisma.TransactionClient,
  draftId: string,
  userId: number,
) {
  const reservation = await tx.contractPublicationDraft.updateMany({
    where: {
      id: draftId,
      claimedByUserId: userId,
      status: ContractPublicationDraftStatus.claimed,
      contractId: null,
    },
    data: { status: ContractPublicationDraftStatus.publishing },
  });

  if (reservation.count !== 1) {
    throw new ApplicationError(
      "CONTRACT_PUBLICATION_DRAFT_PUBLISHING",
      "The contract is already being published.",
      409,
    );
  }
}

export async function completeContractPublicationDraft(
  tx: Prisma.TransactionClient,
  draftId: string,
  contractId: number,
) {
  await tx.contractPublicationDraft.update({
    where: { id: draftId },
    data: {
      status: ContractPublicationDraftStatus.published,
      contractId,
      publishedAt: new Date(),
    },
  });
}
