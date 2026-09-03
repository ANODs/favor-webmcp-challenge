/* eslint-disable @typescript-eslint/no-require-imports */
const { getBlockingRestriction } = require("../../shared/lib/account-restrictions");
const { env } = require("../../shared/config/env");
const { botText } = require("../../shared/lib/copy");
const { buildContractUrl } = require("../../shared/lib/links");
const { prisma } = require("../../shared/lib/prisma");
const {
  answerCallbackQuery,
  sendTextMessage,
} = require("../../shared/lib/telegram-api");
const { parseQuestionCallback } = require("./callback");

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

function isContractQuestionAnswerableByAuthor(contract, authorId) {
  return (
    contract.authorId === authorId &&
    contract.authorId !== contract.scoutId
  );
}

async function getQuestionForAuthor(questionId, telegramUserId) {
  const question = await prisma.contractQuestion.findUnique({
    where: { id: questionId },
    include: {
      contract: {
        select: {
          authorId: true,
          scoutId: true,
          slug: true,
          titleRu: true,
          titleEn: true,
          author: { select: { telegramId: true } },
        },
      },
    },
  });

  if (
    !question ||
    question.contract.author.telegramId !== BigInt(telegramUserId) ||
    question.contract.authorId === question.contract.scoutId
  ) {
    return null;
  }

  return question;
}

async function handleContractQuestionCallbackQuery(callbackQuery, locale = "ru") {
  const parsed = parseQuestionCallback(callbackQuery.data);

  if (!parsed) {
    return false;
  }

  const telegramUserId = callbackQuery.from?.id;
  const chatId = callbackQuery.message?.chat?.id;

  if (!telegramUserId || !chatId) {
    await answerCallbackQuery(callbackQuery.id);
    return true;
  }

  const question = await getQuestionForAuthor(parsed.questionId, telegramUserId);

  if (!question) {
    await answerCallbackQuery(
      callbackQuery.id,
      botText(locale, "question.notFound"),
      true,
    );
    return true;
  }

  if (parsed.action === "answer") {
    if (question.status === "dismissed") {
      await answerCallbackQuery(
        callbackQuery.id,
        botText(locale, "question.dismissedAlready"),
        true,
      );
      return true;
    }

    await prisma.contractQuestionReplySession.upsert({
      where: { authorId: question.contract.authorId },
      update: {
        questionId: question.id,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      },
      create: {
        authorId: question.contract.authorId,
        questionId: question.id,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      },
    });
    await answerCallbackQuery(callbackQuery.id);
    await sendTextMessage(
      chatId,
      botText(locale, "question.writeAnswer", { question: question.question }),
    );
    return true;
  }

  if (parsed.action === "dismiss") {
    await prisma.$transaction([
      prisma.contractQuestion.update({
        where: { id: question.id },
        data: { status: "dismissed", publishedAt: null },
      }),
      prisma.contractQuestionReplySession.deleteMany({
        where: { questionId: question.id },
      }),
    ]);
    await answerCallbackQuery(
      callbackQuery.id,
      botText(locale, "question.dismissed"),
    );
    return true;
  }

  if (!question.answer) {
    await answerCallbackQuery(
      callbackQuery.id,
      botText(locale, "question.answerFirst"),
      true,
    );
    return true;
  }

  const shouldPublish = parsed.action === "publish";
  await prisma.contractQuestion.update({
    where: { id: question.id },
    data: {
      status: shouldPublish ? "published" : "answered_hidden",
      publishedAt: shouldPublish ? new Date() : null,
    },
  });
  await answerCallbackQuery(
    callbackQuery.id,
    shouldPublish
      ? botText(locale, "question.published")
      : botText(locale, "question.hidden"),
  );
  await sendTextMessage(
    chatId,
    shouldPublish
      ? botText(locale, "question.visibleOnPage")
      : botText(locale, "question.hiddenOnPage"),
    [
      shouldPublish
        ? {
            text: botText(locale, "question.hideAnswer"),
            callback_data: `cq:hide:${question.id}`,
          }
        : {
            text: botText(locale, "question.publishAnswer"),
            callback_data: `cq:publish:${question.id}`,
          },
      {
        text: botText(locale, "question.openContract"),
        url: buildContractUrl(env.telegramBotUsername, question.contract.slug),
      },
    ],
  );
  return true;
}

async function handleContractQuestionReply(message, locale = "ru") {
  const telegramUserId = message.from?.id;

  if (!telegramUserId) {
    return false;
  }

  const author = await prisma.user.findUnique({
    where: { telegramId: BigInt(telegramUserId) },
    select: {
      id: true,
      contractQuestionReplySession: {
        include: {
          question: {
            include: {
              asker: { select: { telegramId: true, languageCode: true } },
              contract: {
                select: {
                  authorId: true,
                  scoutId: true,
                  slug: true,
                  titleRu: true,
                  titleEn: true,
                },
              },
            },
          },
        },
      },
    },
  });
  const session = author?.contractQuestionReplySession;

  if (!author || !session) {
    return false;
  }

  if (session.expiresAt <= new Date()) {
    await prisma.contractQuestionReplySession.delete({ where: { authorId: author.id } });
    await sendTextMessage(
      message.chat.id,
      botText(locale, "question.sessionExpired"),
    );
    return true;
  }

  if (message.text?.trim() === "/cancel") {
    await prisma.contractQuestionReplySession.delete({ where: { authorId: author.id } });
    await sendTextMessage(
      message.chat.id,
      botText(locale, "question.replyCanceled"),
    );
    return true;
  }

  if (!message.text) {
    return false;
  }

  if (message.text.startsWith("/")) {
    await prisma.contractQuestionReplySession.delete({ where: { authorId: author.id } });
    return false;
  }

  const answer = message.text.trim();
  if (answer.length < 2 || answer.length > 4000) {
    await sendTextMessage(
      message.chat.id,
      botText(locale, "question.invalidLength"),
    );
    return true;
  }

  const restriction = await getBlockingRestriction(telegramUserId, "communication");
  if (restriction) {
    await sendTextMessage(message.chat.id, restriction.publicMessage);
    return true;
  }

  const question = session.question;
  if (
    !isContractQuestionAnswerableByAuthor(question.contract, author.id)
  ) {
    await prisma.contractQuestionReplySession.delete({ where: { authorId: author.id } });
    return true;
  }

  await prisma.$transaction([
    prisma.contractQuestion.update({
      where: { id: question.id },
      data: {
        answer,
        answeredById: author.id,
        answeredAt: new Date(),
        status: "answered_hidden",
        publishedAt: null,
      },
    }),
    prisma.contractQuestionReplySession.delete({ where: { authorId: author.id } }),
  ]);

  if (question.asker) {
    const askerLocale = question.asker.languageCode?.toLowerCase().startsWith("en") ? "en" : "ru";
    const title =
      (askerLocale === "en"
        ? question.contract.titleEn || question.contract.titleRu
        : question.contract.titleRu || question.contract.titleEn) ||
      botText(askerLocale, "question.contractFallback");

    try {
      await sendTextMessage(
        question.asker.telegramId.toString(),
        botText(askerLocale, "question.askerNotification", {
          answer,
          question: question.question,
          title,
        }),
        [
          {
            text: botText(askerLocale, "question.openContract"),
            url: buildContractUrl(env.telegramBotUsername, question.contract.slug),
          },
        ],
      );
    } catch (error) {
      console.error("[contract-question] failed to notify asker", { questionId: question.id, error });
    }
  }

  await sendTextMessage(
    message.chat.id,
    botText(locale, "question.publicationPrompt"),
    [
      {
        text: botText(locale, "question.publish"),
        callback_data: `cq:publish:${question.id}`,
      },
      {
        text: botText(locale, "question.keepPrivate"),
        callback_data: `cq:hide:${question.id}`,
      },
    ],
  );
  return true;
}

module.exports = {
  handleContractQuestionCallbackQuery,
  handleContractQuestionReply,
  isContractQuestionAnswerableByAuthor,
};
