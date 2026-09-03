/* eslint-disable @typescript-eslint/no-require-imports */
const { Blob } = require("node:buffer");
const { readFile } = require("node:fs/promises");
const path = require("node:path");

const { env } = require("../config/env");
const { createProxyFormData, proxyFetch } = require("./proxy-fetch");
const { TelegramApiError } = require("./telegram-api-error");
const {
  buildTelegramRichVideoInput,
} = require("../../../../src/shared/lib/telegram/rich-message.runtime.cjs");

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const RETRY_BASE_DELAY_MS = 400;
const RETRY_MAX_DELAY_MS = 5000;
const TELEGRAM_ALLOWED_UPDATES = [
  "message",
  "callback_query",
  "inline_query",
  "pre_checkout_query",
];

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getRetryDelayMs(data, attempt) {
  const retryAfterSeconds = Number(data?.parameters?.retry_after);

  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return Math.min(retryAfterSeconds * 1000, RETRY_MAX_DELAY_MS);
  }

  return Math.min(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1), RETRY_MAX_DELAY_MS);
}

async function callTelegramApi(method, payload, options = {}) {
  const maxAttempts = Math.max(1, options.maxAttempts || 1);
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let response;
    let rawBody = "";

    try {
      response = await proxyFetch(
        `https://api.telegram.org/bot${env.telegramBotToken}/${method}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );
      rawBody = await response.text().catch(() => "");
    } catch (error) {
      lastError = error;

      if (attempt === maxAttempts) {
        throw error;
      }

      await sleep(getRetryDelayMs(null, attempt));
      continue;
    }

    let data = null;

    try {
      data = rawBody ? JSON.parse(rawBody) : null;
    } catch {
      data = null;
    }

    if (response.ok && data?.ok) {
      return data.result;
    }

    const errorCode = Number(data?.error_code) || response.status;
    const description = data?.description || rawBody || "Unknown Telegram API error";
    lastError = new TelegramApiError(
      method,
      errorCode,
      description,
      data?.parameters,
    );

    if (!RETRYABLE_STATUS_CODES.has(errorCode) || attempt === maxAttempts) {
      throw lastError;
    }

    await sleep(getRetryDelayMs(data, attempt));
  }

  throw lastError;
}

async function callTelegramMultipartApi(method, formData) {
  const response = await proxyFetch(
    `https://api.telegram.org/bot${env.telegramBotToken}/${method}`,
    {
      method: "POST",
      body: formData,
    },
  );
  const rawBody = await response.text().catch(() => "");
  let data = null;

  try {
    data = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    data = null;
  }

  if (response.ok && data?.ok) {
    return data.result;
  }

  throw new TelegramApiError(
    method,
    Number(data?.error_code) || response.status,
    data?.description || rawBody || "Unknown Telegram API error",
    data?.parameters,
  );
}

function getUpdates(offset) {
  return callTelegramApi("getUpdates", {
    offset,
    timeout: env.pollingTimeoutSeconds,
    allowed_updates: TELEGRAM_ALLOWED_UPDATES,
  }, { maxAttempts: 3 });
}

function deleteWebhook() {
  return callTelegramApi("deleteWebhook", {
    drop_pending_updates: false,
  }, { maxAttempts: 3 });
}

function sendTextMessage(chatId, text, buttons = [], options = {}) {
  return callTelegramApi("sendMessage", {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
    parse_mode: options.parseMode,
    reply_markup:
      options.replyMarkup ??
      (buttons.length
        ? {
            inline_keyboard: buttons.map((button) => [button]),
          }
        : undefined),
  });
}

function sendRichMessage(chatId, html, buttons = [], options = {}) {
  return callTelegramApi("sendRichMessage", {
    chat_id: chatId,
    rich_message: {
      html,
      media: options.media?.length ? options.media : undefined,
    },
    reply_markup: buttons.length
      ? {
          inline_keyboard: buttons.map((button) => [button]),
        }
      : undefined,
  });
}

async function sendRichVideoMessage(chatId, html, videoPath, media) {
  const bytes = await readFile(videoPath);
  const formData = createProxyFormData();
  const richMessage = buildTelegramRichVideoInput({
    html,
    mediaId: media.mediaId,
    attachmentName: media.attachmentName,
    width: media.width,
    height: media.height,
    duration: media.duration,
  });

  formData.append("chat_id", String(chatId));
  formData.append("rich_message", JSON.stringify(richMessage));
  formData.append(
    media.attachmentName,
    new Blob([bytes], { type: "video/mp4" }),
    path.basename(videoPath),
  );

  return callTelegramMultipartApi("sendRichMessage", formData);
}

function deleteMessage(chatId, messageId) {
  return callTelegramApi("deleteMessage", {
    chat_id: chatId,
    message_id: messageId,
  });
}

function answerCallbackQuery(callbackQueryId, text, showAlert = false) {
  return callTelegramApi("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text,
    show_alert: showAlert,
  });
}

function answerInlineQuery(inlineQueryId, results, options = {}) {
  return callTelegramApi("answerInlineQuery", {
    inline_query_id: inlineQueryId,
    results,
    cache_time: options.cacheTime ?? 5,
    is_personal: options.isPersonal ?? true,
    next_offset: options.nextOffset ?? "",
    button: options.button,
  }, { maxAttempts: 2 });
}

function copyMessage(chatId, fromChatId, messageId, replyToMessageId) {
  return callTelegramApi("copyMessage", {
    chat_id: chatId,
    from_chat_id: fromChatId,
    message_id: messageId,
    reply_parameters: replyToMessageId
      ? {
          message_id: replyToMessageId,
          allow_sending_without_reply: true,
        }
      : undefined,
  });
}

function answerPreCheckoutQuery(preCheckoutQueryId, ok, errorMessage) {
  return callTelegramApi("answerPreCheckoutQuery", {
    pre_checkout_query_id: preCheckoutQueryId,
    ok,
    error_message: ok ? undefined : errorMessage,
  });
}

function setMyCommands(commands, options = {}) {
  return callTelegramApi("setMyCommands", {
    commands,
    language_code: options.languageCode,
  }, { maxAttempts: 3 });
}

module.exports = {
  answerCallbackQuery,
  answerInlineQuery,
  answerPreCheckoutQuery,
  copyMessage,
  deleteMessage,
  deleteWebhook,
  getUpdates,
  sendRichMessage,
  sendRichVideoMessage,
  sendTextMessage,
  setMyCommands,
  TELEGRAM_ALLOWED_UPDATES,
};
