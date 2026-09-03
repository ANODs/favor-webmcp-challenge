import { ContractQuestionStatus } from "@prisma/client";

import { areContractQuestionsEnabled } from "@/entities/contract";
import { askContractQuestionSchema } from "@/entities/contract-question";
import { requireUserCapability } from "@/entities/user/server";
import {
  buildContractQuestionFingerprint,
  notifyContractAuthorAboutQuestion,
} from "@/features/contract-questions/server";
import { handleRouteError, ok } from "@/shared/lib/api";
import { enforceRateLimit } from "@/shared/lib/rate-limit";
import { prisma } from "@/shared/lib/prisma";

type Params = {
  params: Promise<{ slug: string }>;
};

export async function GET(_request: Request, { params }: Params) {
  try {
    const { slug } = await params;
    const contract = await prisma.contract.findUnique({
      where: { slug },
      select: { id: true, authorId: true, scoutId: true, status: true },
    });

    if (!contract) {
      throw new Error("NOT_FOUND");
    }

    const enabled = areContractQuestionsEnabled(contract);

    if (!enabled) {
      return ok({ enabled: false, total: 0, items: [] });
    }

    const questions = await prisma.contractQuestion.findMany({
      where: {
        contractId: contract.id,
        status: ContractQuestionStatus.published,
        answer: { not: null },
      },
      select: {
        id: true,
        question: true,
        answer: true,
        createdAt: true,
        publishedAt: true,
      },
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    });

    return ok({
      enabled: true,
      total: questions.length,
      items: questions.map((question) => ({
        ...question,
        answer: question.answer ?? "",
      })),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const user = await requireUserCapability("communication:write");
    const { slug } = await params;
    const payload = askContractQuestionSchema.parse(await request.json());
    const contract = await prisma.contract.findUnique({
      where: { slug },
      select: {
        id: true,
        authorId: true,
        scoutId: true,
        status: true,
        slug: true,
        titleRu: true,
        titleEn: true,
        author: {
          select: { telegramId: true, languageCode: true },
        },
      },
    });

    if (!contract) {
      throw new Error("NOT_FOUND");
    }

    if (!areContractQuestionsEnabled(contract)) {
      throw new Error("CONTRACT_QUESTIONS_UNAVAILABLE");
    }

    if (contract.authorId === user.id) {
      throw new Error("CONTRACT_AUTHOR_QUESTION_FORBIDDEN");
    }

    await Promise.all([
      enforceRateLimit({
        key: `contract-question:user:${user.id}`,
        limit: 8,
        windowMs: 60 * 60 * 1000,
      }),
      enforceRateLimit({
        key: `contract-question:contract:${contract.id}:user:${user.id}`,
        limit: 3,
        windowMs: 60 * 60 * 1000,
      }),
    ]);

    const contentFingerprint = buildContractQuestionFingerprint(payload.question);
    const existing = await prisma.contractQuestion.findFirst({
      where: {
        contractId: contract.id,
        askerId: user.id,
        contentFingerprint,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        status: { not: ContractQuestionStatus.dismissed },
      },
      select: { id: true, deliveryStatus: true },
    });

    if (existing) {
      return ok({ id: existing.id, delivered: existing.deliveryStatus !== "failed" });
    }

    const question = await prisma.contractQuestion.create({
      data: {
        contractId: contract.id,
        askerId: user.id,
        question: payload.question,
        contentFingerprint,
      },
      select: { id: true },
    });

    const sent = await notifyContractAuthorAboutQuestion({
      questionId: question.id,
      question: payload.question,
      contract,
    });

    if (!sent) {
      await prisma.contractQuestion.delete({ where: { id: question.id } });
      throw new Error("CONTRACT_QUESTION_DELIVERY_FAILED");
    }

    await prisma.contractQuestion.update({
      where: { id: question.id },
      data: {
        deliveryStatus: "sent",
        authorTelegramMessageId: BigInt(sent.messageId),
      },
    });

    return ok({ id: question.id, delivered: true }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
