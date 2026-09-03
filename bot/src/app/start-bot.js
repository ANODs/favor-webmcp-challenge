/* eslint-disable @typescript-eslint/no-require-imports */
const { parseTelegramCommand } = require("../entities/telegram-command");
const {
  activatePremiumForSuccessfulPayment,
  validatePreCheckoutQuery,
} = require("../features/handle-payment");
const { buildReplyByPayload } = require("../features/handle-start-command");
const {
  handleContractQuestionCallbackQuery,
  handleContractQuestionReply,
} = require("../features/handle-contract-question");
const {
  handleContractInlineQuery,
} = require("../features/handle-contract-inline-query");
const {
  handleReportCallbackQuery,
  handleReportCommand,
} = require("../features/handle-report-command");
const { handleResultCommand } = require("../features/handle-result-command");
const {
  notifySubscriptionGiftRecipient,
} = require("../features/notify-subscription-gift");
const { env } = require("../shared/config/env");
const { botText } = require("../shared/lib/copy");
const {
  isExpiredPreCheckoutQueryError,
} = require("../shared/lib/telegram-api-error");
const {
  answerInlineQuery,
  answerPreCheckoutQuery,
  deleteWebhook,
  getUpdates,
  sendRichMessage,
  sendTextMessage,
  setMyCommands,
  TELEGRAM_ALLOWED_UPDATES,
} = require("../shared/lib/telegram-api");
const { consumeRateLimit } = require("../shared/lib/rate-limit");
const {
  isTelegramUpdateProcessed,
  registerTelegramUpdate,
} = require("../shared/lib/telegram-update-deduplication");
const { resolveUserLocale } = require("../shared/lib/user-locale");

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function ensurePollingMode() {
  let consecutiveFailures = 0;

  while (true) {
    try {
      await deleteWebhook();
      return;
    } catch (error) {
      consecutiveFailures += 1;
      const retryDelayMs = Math.min(
        env.pollingRetryDelayMs * 2 ** Math.min(consecutiveFailures - 1, 4),
        30000,
      );
      console.error(
        `[favor-bot] failed to enable polling; retrying in ${retryDelayMs}ms`,
        error,
      );
      await sleep(retryDelayMs);
    }
  }
}

async function sendSuccessfulPaymentMessages(message, locale, result, dependencies = {}) {
  const sendMessage = dependencies.sendTextMessage || sendTextMessage;
  const logError = dependencies.logError || console.error;

  await notifySubscriptionGiftRecipient(result, {
    botUsername: dependencies.botUsername,
    logError,
    sendRichMessage: dependencies.sendRichMessage,
    sendRichVideoMessage: dependencies.sendRichVideoMessage,
    videoPath: dependencies.videoPath,
  });

  const recipientName =
    result.recipient?.displayName ||
    botText(locale, "app.paymentRecipientFallback");

  try {
    await sendMessage(
      message.chat.id,
      result.activated
        ? result.isGift
          ? botText(locale, "app.paymentGiftActivated", { recipientName })
          : botText(locale, "app.paymentActivated")
        : botText(locale, "app.paymentAccountMissing"),
    );
  } catch (error) {
    logError("[favor-bot] failed to send subscription payment result", {
      payerId: result.payer?.id ?? null,
      error,
    });
  }
}

async function handleMessage(message) {
  const locale = await resolveUserLocale(message.from);
  const telegramUserId = message.from?.id;

  if (message.successful_payment) {
    const result = await activatePremiumForSuccessfulPayment(message);
    await sendSuccessfulPaymentMessages(message, locale, result);
    return;
  }

  if (telegramUserId) {
    const messageLimit = await consumeRateLimit({
      key: `bot:message:${telegramUserId}`,
      limit: 60,
      windowMs: 60 * 1000,
    });

    if (!messageLimit.allowed) {
      return;
    }
  }

  if (
    !message.text &&
    !message.caption &&
    !message.contact &&
    !message.document &&
    !message.photo
  ) {
    return;
  }

  if (await handleContractQuestionReply(message, locale)) {
    return;
  }

  if (await handleReportCommand(message, env.telegramBotUsername, locale)) {
    return;
  }

  if (await handleResultCommand(message, env.telegramBotUsername, locale)) {
    return;
  }

  if (!message.text) {
    return;
  }

  const command = parseTelegramCommand(message.text, env.telegramBotUsername);

  if (!command) {
    if (message.document || message.photo) {
      await sendTextMessage(
        message.chat.id,
        botText(locale, "app.resultCaptionHint"),
      );
    }
    return;
  }

  if (command.command === "/start" || command.command === "/help") {
    if (telegramUserId) {
      const commandLimit = await consumeRateLimit({
        key: `bot:start:${telegramUserId}`,
        limit: 20,
        windowMs: 60 * 1000,
      });

      if (!commandLimit.allowed) {
        return;
      }
    }

    const reply = buildReplyByPayload(env.telegramBotUsername, command.payload, locale);

    if (reply.richHtml) {
      try {
        await sendRichMessage(message.chat.id, reply.richHtml, reply.buttons);
        return;
      } catch (error) {
        console.error("[favor-bot] failed to send rich start message, using fallback", error);
      }
    }

    await sendTextMessage(
      message.chat.id,
      reply.text,
      reply.fallbackButtons || reply.buttons,
    );
    return;
  }

  await sendTextMessage(
    message.chat.id,
    botText(locale, "app.unknownCommand"),
  );
}

async function handlePreCheckoutQuery(preCheckoutQuery) {
  const locale = await resolveUserLocale(preCheckoutQuery.from);
  const validation = await validatePreCheckoutQuery(preCheckoutQuery, locale);

  try {
    await answerPreCheckoutQuery(
      preCheckoutQuery.id,
      validation.ok,
      validation.ok ? undefined : validation.errorMessage,
    );
  } catch (error) {
    if (isExpiredPreCheckoutQueryError(error)) {
      console.warn("[favor-bot] pre-checkout query expired before Telegram accepted the answer");
      return;
    }

    throw error;
  }
}

async function handleInlineQuery(inlineQuery) {
  const telegramUserId = inlineQuery.from?.id;
  const inlineLimit = telegramUserId
    ? await consumeRateLimit({
        key: `bot:inline:${telegramUserId}`,
        limit: 60,
        windowMs: 60 * 1000,
      })
    : { allowed: false };

  if (!inlineLimit.allowed) {
    await answerInlineQuery(inlineQuery.id, [], {
      cacheTime: 1,
      isPersonal: true,
      nextOffset: "",
    });
    console.warn("[favor-bot] inline query rate limited");
    return;
  }

  const locale = await resolveUserLocale(inlineQuery.from);
  const startedAt = Date.now();
  const outcome = await handleContractInlineQuery(inlineQuery, {
    baseUrl: env.baseUrl,
    botUsername: env.telegramBotUsername,
    locale,
  });
  console.info("[favor-bot] inline query handled", {
    status: outcome.status,
    count: outcome.count,
    emptyQuery: !inlineQuery.query?.trim(),
    durationMs: Date.now() - startedAt,
  });
}

async function handleCallbackQuery(callbackQuery) {
  const callbackUserId = callbackQuery.from?.id;
  const callbackLimit = callbackUserId
    ? await consumeRateLimit({
        key: `bot:callback:${callbackUserId}`,
        limit: 30,
        windowMs: 60 * 1000,
      })
    : { allowed: true };

  if (!callbackLimit.allowed) return;

  const locale = await resolveUserLocale(callbackQuery.from);
  if (!(await handleContractQuestionCallbackQuery(callbackQuery, locale))) {
    await handleReportCallbackQuery(callbackQuery, locale);
  }
}

function isSuccessfulPaymentUpdate(update) {
  return Boolean(update.message?.successful_payment);
}

function shouldDeferUpdateCompletion(update) {
  return isSuccessfulPaymentUpdate(update) || Boolean(update.pre_checkout_query);
}

async function processTelegramUpdate(update, dependencies = {}) {
  const registerUpdate = dependencies.registerTelegramUpdate || registerTelegramUpdate;
  const wasUpdateProcessed =
    dependencies.isTelegramUpdateProcessed || isTelegramUpdateProcessed;
  const processPreCheckout = dependencies.handlePreCheckoutQuery || handlePreCheckoutQuery;
  const processInlineQuery = dependencies.handleInlineQuery || handleInlineQuery;
  const processCallbackQuery = dependencies.handleCallbackQuery || handleCallbackQuery;
  const processMessage = dependencies.handleMessage || handleMessage;
  const registerAfterProcessing = shouldDeferUpdateCompletion(update);

  if (registerAfterProcessing) {
    if (await wasUpdateProcessed(update.update_id)) {
      return { handled: false, duplicate: true };
    }
  } else if (!(await registerUpdate(update.update_id))) {
    return { handled: false, duplicate: true };
  }

  if (update.pre_checkout_query) {
    await processPreCheckout(update.pre_checkout_query);
  }

  if (update.inline_query) {
    await processInlineQuery(update.inline_query);
  }

  if (update.callback_query) {
    await processCallbackQuery(update.callback_query);
  }

  if (update.message) {
    await processMessage(update.message);
  }

  if (registerAfterProcessing) {
    await registerUpdate(update.update_id);
  }

  return { handled: true, duplicate: false };
}

async function startBot() {
  console.info("[favor-bot] starting");
  console.info(`[favor-bot] Telegram transport: ${env.telegramProxyUrl ? "proxy" : "direct"}`);
  console.info(`[favor-bot] allowed updates: ${TELEGRAM_ALLOWED_UPDATES.join(", ")}`);
  await ensurePollingMode();
  
  try {
    const commandNames = ["start", "help", "report"];
    const russianCommands = commandNames.map((command) => ({
      command,
      description: botText("ru", `app.commands.${command}`),
    }));
    await setMyCommands(russianCommands);
    await setMyCommands(
      commandNames.map((command) => ({
        command,
        description: botText("en", `app.commands.${command}`),
      })),
      { languageCode: "en" },
    );
  } catch (error) {
    console.error("[favor-bot] failed to set commands", error);
  }

  let offset = 0;
  let consecutivePollingFailures = 0;

  while (true) {
    try {
      const updates = await getUpdates(offset);

      for (const update of updates) {
        const deferOffset = shouldDeferUpdateCompletion(update);

        if (!deferOffset) {
          offset = update.update_id + 1;
        }

        await processTelegramUpdate(update);

        if (deferOffset) {
          offset = update.update_id + 1;
        }
      }
      consecutivePollingFailures = 0;
    } catch (error) {
      consecutivePollingFailures += 1;
      const retryDelayMs = Math.min(
        env.pollingRetryDelayMs * 2 ** Math.min(consecutivePollingFailures - 1, 4),
        30000,
      );
      console.error(`[favor-bot] polling failed; retrying in ${retryDelayMs}ms`, error);
      await sleep(retryDelayMs);
    }
  }
}

if (require.main === module) {
  startBot().catch((error) => {
    console.error("[favor-bot] fatal", error);
    process.exit(1);
  });
}

module.exports = {
  handleMessage,
  isSuccessfulPaymentUpdate,
  processTelegramUpdate,
  sendSuccessfulPaymentMessages,
  shouldDeferUpdateCompletion,
  startBot,
};
