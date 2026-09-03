/* eslint-disable @typescript-eslint/no-require-imports */
const { parseTelegramCommand } = require("../../entities/telegram-command");
const { getBlockingRestriction } = require("../../shared/lib/account-restrictions");
const { botText } = require("../../shared/lib/copy");
const { consumeRateLimit } = require("../../shared/lib/rate-limit");
const { sendTextMessage } = require("../../shared/lib/telegram-api");
const { prisma } = require("../../shared/lib/prisma");

async function handleResultCommand(message, botUsername, locale = "ru") {
  const text = message.text || message.caption || "";
  const command = parseTelegramCommand(text, botUsername);

  if (!command || command.command !== "/result") {
    return false; // Not handled
  }

  const telegramUserId = message.from?.id;
  if (!telegramUserId) {
    return true; // Handled, but no user id
  }

  const restriction = await getBlockingRestriction(telegramUserId, "communication");
  if (restriction) {
    await sendTextMessage(message.chat.id, restriction.publicMessage);
    return true;
  }

  const rateLimit = await consumeRateLimit({
    key: `bot:result:${telegramUserId}`,
    limit: 10,
    windowMs: 60 * 60 * 1000,
  });

  if (!rateLimit.allowed) {
    await sendTextMessage(message.chat.id, botText(locale, "result.rateLimited"));
    return true;
  }

  const parts = command.payload ? command.payload.split(" ") : [];
  if (parts.length === 0 || !parts[0]) {
    await sendTextMessage(message.chat.id, botText(locale, "result.usage"));
    return true;
  }

  const dealId = parseInt(parts[0], 10);
  if (isNaN(dealId) || dealId <= 0) {
    await sendTextMessage(message.chat.id, botText(locale, "result.invalidDealId"));
    return true;
  }

  // Get rest of payload
  const resultData = parts.slice(1).join(" ");
  let resultFileId = null;

  if (message.document) {
    resultFileId = message.document.file_id;
  } else if (message.photo && message.photo.length > 0) {
    // Get highest quality photo
    const photo = message.photo[message.photo.length - 1];
    resultFileId = photo.file_id;
  }

  if (!resultData && !resultFileId) {
    await sendTextMessage(message.chat.id, botText(locale, "result.missingDeliverable"));
    return true;
  }

  try {
    // Check if the deal exists and the user is part of it
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      include: {
        customer: true,
        freelancer: true,
      },
    });

    if (!deal) {
      await sendTextMessage(
        message.chat.id,
        botText(locale, "result.dealNotFound", { dealId }),
      );
      return true;
    }

    const isCustomer = deal.customer.telegramId === BigInt(telegramUserId);
    const isFreelancer = deal.freelancer.telegramId === BigInt(telegramUserId);

    if (!isCustomer && !isFreelancer) {
      await sendTextMessage(message.chat.id, botText(locale, "result.notParticipant"));
      return true;
    }

    await prisma.deal.update({
      where: { id: dealId },
      data: {
        resultData: resultData || null,
        resultFileId: resultFileId || null,
      },
    });

    await sendTextMessage(
      message.chat.id,
      botText(locale, "result.saved", { dealId }),
    );
  } catch (error) {
    console.error(`[handle-result-command] failed to save result for deal ${dealId}`, error);
    await sendTextMessage(message.chat.id, botText(locale, "result.saveFailed"));
  }

  return true;
}

module.exports = { handleResultCommand };
