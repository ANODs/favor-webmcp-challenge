/* eslint-disable @typescript-eslint/no-require-imports */
const { createHash, randomUUID } = require("node:crypto");

const { parseTelegramCommand } = require("../../entities/telegram-command");
const { env } = require("../../shared/config/env");
const { getBlockingRestriction } = require("../../shared/lib/account-restrictions");
const { botText } = require("../../shared/lib/copy");
const { prisma } = require("../../shared/lib/prisma");
const { consumeRateLimit } = require("../../shared/lib/rate-limit");
const {
  answerCallbackQuery,
  deleteMessage,
  sendRichMessage,
  sendTextMessage,
} = require("../../shared/lib/telegram-api");
const {
  buildReportPreview,
  buildReportPreviewButtons,
  parseReportCallback,
} = require("./preview");
const { buildSupportTicketRichMessage } = require("./ticket");

const SUBMIT_LABEL = botText("ru", "report.submitLabel");
const CANCEL_LABEL = botText("ru", "report.cancelLabel");
const SUBMIT_LABEL_EN = botText("en", "report.submitLabel");
const CANCEL_LABEL_EN = botText("en", "report.cancelLabel");
const MAX_PHOTOS = 10;
const MAX_DESCRIPTION_PARTS = 20;
const MAX_DESCRIPTION_LENGTH = 8000;
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

const reportSessions = new Map();

const removeKeyboard = {
  remove_keyboard: true,
};

function getReportKeyboard(locale) {
  return {
    keyboard: [
      [
        {
          text: botText(locale, "report.shareContact"),
          request_contact: true,
        },
      ],
    ],
    resize_keyboard: true,
    is_persistent: true,
  };
}

function getSessionKeyFromChatId(chatId) {
  return String(chatId);
}

function getSessionKey(message) {
  return getSessionKeyFromChatId(message.chat.id);
}

function buildDescription(session) {
  return (session.descriptionParts || []).filter(Boolean).join("\n\n").trim();
}

function canAppendDescription(session, value) {
  const nextPart = value.trim();
  const nextLength = buildDescription(session).length + nextPart.length + 2;

  return (
    nextPart.length > 0 &&
    session.descriptionParts.length < MAX_DESCRIPTION_PARTS &&
    nextLength <= MAX_DESCRIPTION_LENGTH
  );
}

function hashDescription(value) {
  const normalized = value.toLowerCase().replace(/\s+/g, " ").trim();
  return createHash("sha256").update(normalized).digest("hex");
}

function formatRetryTime(retryAfterMs, locale) {
  const minutes = Math.max(1, Math.ceil(retryAfterMs / 60000));
  return botText(locale, "report.retryMinutes", { minutes });
}

function cleanupExpiredSessions() {
  const expirationThreshold = Date.now() - SESSION_TTL_MS;

  for (const [key, session] of reportSessions.entries()) {
    if (session.startedAt < expirationThreshold) {
      reportSessions.delete(key);
    }
  }
}

function getReportSource(command, locale = "ru") {
  if (command?.command === "/report") {
    return {
      source: botText(locale, "report.sourceReport"),
      errorCode: null,
    };
  }

  if (command?.command !== "/start") {
    return null;
  }

  if (command.payload === "report") {
    return { source: botText(locale, "report.sourceMiniApp"), errorCode: null };
  }

  if (command.payload.startsWith("report_error")) {
    const diagnosticPublicId = command.payload.slice("report_error_".length).trim() || null;
    return {
      source: botText(locale, "report.sourceError"),
      errorCode: diagnosticPublicId,
      diagnosticPublicId,
    };
  }

  return null;
}

function isReportStart(command, locale) {
  return command?.command === "/report" || Boolean(getReportSource(command, locale));
}

async function removePreview(chatId, session) {
  if (!session?.previewMessageId) {
    return;
  }

  const previewMessageId = session.previewMessageId;
  session.previewMessageId = null;

  try {
    await deleteMessage(chatId, previewMessageId);
  } catch (error) {
    console.warn("[handle-report-command] failed to remove ticket preview", {
      chatId,
      previewMessageId,
      error,
    });
  }
}

async function refreshPreview(chatId, session) {
  const previousPreviewMessageId = session.previewMessageId;
  const preview = await sendTextMessage(
    chatId,
    buildReportPreview(session),
    buildReportPreviewButtons(session.id, session.locale),
  );

  session.previewMessageId = preview.message_id;

  if (previousPreviewMessageId) {
    try {
      await deleteMessage(chatId, previousPreviewMessageId);
    } catch (error) {
      console.warn("[handle-report-command] failed to replace ticket preview", {
        chatId,
        previousPreviewMessageId,
        error,
      });
    }
  }
}

async function startReport(message, command, locale) {
  if (!env.supportChatId) {
    await sendTextMessage(
      message.chat.id,
      botText(locale, "report.supportNotConfigured"),
    );
    return true;
  }

  const telegramId = message.from?.id;
  const restriction = await getBlockingRestriction(telegramId, "support");
  if (restriction) {
    await sendTextMessage(message.chat.id, restriction.publicMessage);
    return true;
  }

  const startLimit = await consumeRateLimit({
    key: `support:start:${telegramId || message.chat.id}`,
    limit: 5,
    windowMs: 15 * 60 * 1000,
  });

  if (!startLimit.allowed) {
    await sendTextMessage(
      message.chat.id,
      botText(locale, "report.startRateLimited", {
        retryTime: formatRetryTime(startLimit.retryAfterMs, locale),
      }),
    );
    return true;
  }

  const sessionKey = getSessionKey(message);
  const previousSession = reportSessions.get(sessionKey);

  if (previousSession) {
    await removePreview(message.chat.id, previousSession);
  }

  const reportSource = getReportSource(command, locale) || {
    source: botText(locale, "report.sourceReport"),
    errorCode: null,
  };
  const diagnosticReport = reportSource.diagnosticPublicId
    ? await prisma.clientDiagnosticReport.findFirst({
        where: {
          publicId: reportSource.diagnosticPublicId,
          reporterTelegramId: BigInt(telegramId || message.chat.id),
          expiresAt: { gt: new Date() },
        },
        select: {
          id: true,
          code: true,
          source: true,
          fingerprint: true,
          payload: true,
        },
      })
    : null;
  const diagnosticDescription = diagnosticReport
    ? botText(locale, "report.automaticReport", {
        code: diagnosticReport.code,
        fingerprint: diagnosticReport.fingerprint,
      })
    : null;
  const session = {
    ...reportSource,
    source: diagnosticReport
      ? `${botText(locale, "report.sourceMiniApp")} · ${diagnosticReport.source}`
      : reportSource.source,
    errorCode: diagnosticReport?.code || reportSource.errorCode,
    diagnosticReportId: diagnosticReport?.id || null,
    diagnosticPayload: diagnosticReport?.payload || null,
    locale,
    id: randomUUID().replaceAll("-", "").slice(0, 16),
    startedAt: Date.now(),
    reporter: message.from || {},
    descriptionParts: diagnosticDescription ? [diagnosticDescription] : [],
    contact: null,
    contactLabel: null,
    photoFileIds: [],
    previewMessageId: null,
    hasDescription: Boolean(diagnosticDescription),
    hasContact: false,
    photoCount: 0,
    submitting: false,
  };

  reportSessions.set(sessionKey, session);

  await sendTextMessage(
    message.chat.id,
    diagnosticReport
      ? botText(locale, "report.diagnosticIntro")
      : botText(locale, "report.defaultIntro"),
    [],
    { replyMarkup: getReportKeyboard(locale) },
  );
  await refreshPreview(message.chat.id, session);

  return true;
}

async function cancelReport(chatId, session) {
  reportSessions.delete(getSessionKeyFromChatId(chatId));
  await removePreview(chatId, session);
  await sendTextMessage(
    chatId,
    botText(session.locale, "report.creationCanceled"),
    [],
    {
      replyMarkup: removeKeyboard,
    },
  );
}

async function submitReport(chatId, session, from) {
  if (!session.hasDescription) {
    await sendTextMessage(
      chatId,
      botText(session.locale, "report.descriptionRequired"),
      [],
      { replyMarkup: getReportKeyboard(session.locale) },
    );
    await refreshPreview(chatId, session);
    return false;
  }

  if (session.submitting) {
    return false;
  }

  session.submitting = true;

  const telegramId = from?.id || session.reporter?.id;
  if (!telegramId) {
    session.submitting = false;
    await sendTextMessage(
      chatId,
      botText(session.locale, "report.authorMissing"),
    );
    return false;
  }

  const restriction = await getBlockingRestriction(telegramId, "support");
  if (restriction) {
    session.submitting = false;
    await sendTextMessage(chatId, restriction.publicMessage);
    return false;
  }

  const [hourLimit, dayLimit] = await Promise.all([
    consumeRateLimit({
      key: `support:submit:hour:${telegramId || chatId}`,
      limit: 3,
      windowMs: 60 * 60 * 1000,
    }),
    consumeRateLimit({
      key: `support:submit:day:${telegramId || chatId}`,
      limit: 10,
      windowMs: 24 * 60 * 60 * 1000,
    }),
  ]);

  const blockedLimit = !hourLimit.allowed ? hourLimit : !dayLimit.allowed ? dayLimit : null;
  if (blockedLimit) {
    session.submitting = false;
    await sendTextMessage(
      chatId,
      botText(session.locale, "report.limitReached", {
        retryTime: formatRetryTime(blockedLimit.retryAfterMs, session.locale),
      }),
    );
    return false;
  }

  const description = buildDescription(session);
  const descriptionHash = hashDescription(description);
  const duplicateThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const duplicate = await prisma.supportTicket.findFirst({
    where: {
      reporterTelegramId: BigInt(telegramId),
      descriptionHash,
      status: { not: "failed" },
      createdAt: { gt: duplicateThreshold },
    },
    select: { id: true },
  });

  if (duplicate) {
    session.submitting = false;
    await sendTextMessage(
      chatId,
      botText(session.locale, "report.duplicate"),
    );
    return false;
  }

  const account = await prisma.user.findUnique({
    where: { telegramId: BigInt(telegramId) },
    select: { id: true },
  });
  const storedTicket = await prisma.supportTicket.create({
    data: {
      sessionId: session.id,
      userId: account?.id ?? null,
      diagnosticReportId: session.diagnosticReportId || null,
      reporterTelegramId: BigInt(telegramId),
      source: session.source,
      description,
      descriptionHash,
      contact: session.contact || undefined,
      photoFileIds: session.photoFileIds,
      status: "queued",
    },
  });

  let supportMessage;

  try {
    const ticket = buildSupportTicketRichMessage(session, from || session.reporter);
    supportMessage = await sendRichMessage(env.supportChatId, ticket.html, [], {
      media: ticket.media,
    });
    await prisma.supportTicket.update({
      where: { id: storedTicket.id },
      data: {
        status: "delivered",
        telegramSupportMessageId: BigInt(supportMessage.message_id),
      },
    });
  } catch (error) {
    session.submitting = false;
    await prisma.supportTicket.update({
      where: { id: storedTicket.id },
      data: {
        status: "failed",
        deliveryError: error instanceof Error
          ? error.message.slice(0, 1000)
          : botText(session.locale, "report.unknownError"),
      },
    });
    console.error("[handle-report-command] failed to send rich support ticket", {
      chatId,
      error,
    });
    await sendTextMessage(
      chatId,
      botText(session.locale, "report.deliveryFailed"),
      [],
      { replyMarkup: getReportKeyboard(session.locale) },
    );
    await refreshPreview(chatId, session);
    return false;
  }

  reportSessions.delete(getSessionKeyFromChatId(chatId));
  await removePreview(chatId, session);

  try {
    await sendTextMessage(
      chatId,
      botText(session.locale, "report.confirmation", {
        messageId: supportMessage.message_id,
      }),
      [],
      { replyMarkup: removeKeyboard },
    );
  } catch (error) {
    console.error("[handle-report-command] ticket sent but confirmation failed", {
      chatId,
      ticketMessageId: supportMessage.message_id,
      error,
    });
  }

  return true;
}

async function handleReportCallbackQuery(callbackQuery, locale = "ru") {
  cleanupExpiredSessions();

  const callback = parseReportCallback(callbackQuery.data);

  if (!callback) {
    return false;
  }

  const chatId = callbackQuery.message?.chat?.id;

  if (!chatId) {
    await answerCallbackQuery(
      callbackQuery.id,
      botText(locale, "report.callbackNoChat"),
      true,
    );
    return true;
  }

  const session = reportSessions.get(getSessionKeyFromChatId(chatId));

  if (!session || session.id !== callback.sessionId) {
    await answerCallbackQuery(
      callbackQuery.id,
      botText(locale, "report.stalePreview"),
      true,
    );
    return true;
  }

  if (session.reporter?.id && callbackQuery.from?.id !== session.reporter.id) {
    await answerCallbackQuery(
      callbackQuery.id,
      botText(session.locale, "report.onlyAuthor"),
      true,
    );
    return true;
  }

  if (callback.action === "cancel") {
    await answerCallbackQuery(
      callbackQuery.id,
      botText(session.locale, "report.ticketCanceled"),
    );
    await cancelReport(chatId, session);
    return true;
  }

  if (!session.hasDescription) {
    await answerCallbackQuery(
      callbackQuery.id,
      botText(session.locale, "report.addDescription"),
      true,
    );
    return true;
  }

  if (session.submitting) {
    await answerCallbackQuery(
      callbackQuery.id,
      botText(session.locale, "report.alreadySubmitting"),
    );
    return true;
  }

  await answerCallbackQuery(
    callbackQuery.id,
    botText(session.locale, "report.submitting"),
  );
  await submitReport(chatId, session, callbackQuery.from);
  return true;
}

async function handleReportCommand(message, botUsername, locale = "ru") {
  cleanupExpiredSessions();

  const command = message.text
    ? parseTelegramCommand(message.text, botUsername)
    : null;

  if (isReportStart(command, locale)) {
    return startReport(message, command, locale);
  }

  const session = reportSessions.get(getSessionKey(message));

  if (!session) {
    return false;
  }

  if (
    command?.command === "/cancel" ||
    message.text === CANCEL_LABEL ||
    message.text === CANCEL_LABEL_EN
  ) {
    await cancelReport(message.chat.id, session);
    return true;
  }

  if (
    command?.command === "/done" ||
    message.text === SUBMIT_LABEL ||
    message.text === SUBMIT_LABEL_EN
  ) {
    await submitReport(message.chat.id, session, message.from);
    return true;
  }

  if (command) {
    await sendTextMessage(
      message.chat.id,
      botText(session.locale, "report.commandDuringSession"),
      [],
      { replyMarkup: getReportKeyboard(session.locale) },
    );
    await refreshPreview(message.chat.id, session);
    return true;
  }

  if (message.contact) {
    session.contact = message.contact;
    session.contactLabel = [message.contact.first_name, message.contact.last_name]
      .filter(Boolean)
      .join(" ")
      .trim();
    session.hasContact = true;
    await refreshPreview(message.chat.id, session);
    return true;
  }

  if (message.photo?.length) {
    if (session.photoFileIds.length >= MAX_PHOTOS) {
      await sendTextMessage(
        message.chat.id,
        botText(session.locale, "report.photoLimit", {
          maxPhotos: MAX_PHOTOS,
        }),
        [],
        { replyMarkup: getReportKeyboard(session.locale) },
      );
      await refreshPreview(message.chat.id, session);
      return true;
    }

    const photoFileId = message.photo.at(-1)?.file_id;

    if (photoFileId) {
      session.photoFileIds.push(photoFileId);
      session.photoCount = session.photoFileIds.length;
    }

    if (message.caption?.trim() && canAppendDescription(session, message.caption)) {
      session.descriptionParts.push(message.caption.trim());
      session.hasDescription = true;
    } else if (message.caption?.trim()) {
      await sendTextMessage(
        message.chat.id,
        botText(session.locale, "report.captionTooLong"),
        [],
        { replyMarkup: getReportKeyboard(session.locale) },
      );
    }

    await refreshPreview(message.chat.id, session);
    return true;
  }

  if (message.text?.trim()) {
    const nextPart = message.text.trim();

    if (!canAppendDescription(session, nextPart)) {
      await sendTextMessage(
        message.chat.id,
        botText(session.locale, "report.descriptionLimit"),
        [],
        { replyMarkup: getReportKeyboard(session.locale) },
      );
      return true;
    }

    session.descriptionParts.push(nextPart);
    session.hasDescription = true;
    await refreshPreview(message.chat.id, session);
    return true;
  }

  await sendTextMessage(
    message.chat.id,
    botText(session.locale, "report.unsupportedInput"),
    [],
    { replyMarkup: getReportKeyboard(session.locale) },
  );
  await refreshPreview(message.chat.id, session);
  return true;
}

module.exports = {
  handleReportCallbackQuery,
  handleReportCommand,
};
