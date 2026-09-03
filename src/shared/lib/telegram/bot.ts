import { env } from "@/shared/config/env";
import { createProxyFormData, proxyFetch } from "./proxy-fetch";
import { buildTelegramRichVideoInput } from "./rich-message.runtime.cjs";

type TelegramMessageButton =
  | { text: string; url: string }
  | { text: string; callback_data: string };

export type TelegramInlineKeyboard = TelegramMessageButton[][];

type SendTelegramBotMessageParams = {
  chatId: string;
  text: string;
  buttons?: TelegramMessageButton[];
};

type SendTelegramBotRichMessageParams = {
  chatId: string;
  html: string;
};

type SendTelegramBotRichVideoMessageParams = {
  chatId: string;
  html: string;
  video: Uint8Array;
  filename: string;
  mediaId: string;
  attachmentName: string;
  width?: number;
  height?: number;
  duration?: number;
};

type PreparedInlineMessage = {
  id: string;
  expiration_date: number;
};

type SavePreparedInlineMessageParams = {
  telegramUserId: bigint;
  result: Record<string, unknown>;
};

type TelegramApiResponse<T> =
  | { ok: true; result: T }
  | {
      ok: false;
      error_code?: number;
      description?: string;
      parameters?: { retry_after?: number };
    };

const PREPARED_MESSAGE_MAX_ATTEMPTS = 3;
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

type TelegramSentMessage = {
  message_id: number;
};

type TelegramBotUser = {
  id: number;
  is_bot: true;
  username?: string;
};

type TelegramChatMember =
  | { status: "creator" }
  | { status: "administrator"; can_edit_messages?: boolean }
  | { status: string };

export type TelegramChannelEditorAccessResult =
  | { allowed: true }
  | {
      allowed: false;
      reason:
        | "telegram_channel_access_could_not_be_verified"
        | "telegram_user_cannot_edit_channel";
    };

export type TelegramChannelBotEditorAccessResult =
  | { allowed: true }
  | {
      allowed: false;
      reason:
        | "telegram_bot_access_could_not_be_verified"
        | "telegram_bot_cannot_edit_channel";
    };

export type TelegramPrivateChatWriteAccessDeniedReason =
  | "chat_not_found"
  | "bot_blocked"
  | "user_deactivated"
  | "forbidden";

export type TelegramPrivateChatWriteAccessUnavailableReason =
  | "bot_token_missing"
  | "invalid_telegram_user_id"
  | "transport_error"
  | "rate_limited"
  | "telegram_server_error"
  | "malformed_response"
  | "unexpected_response";

export type TelegramPrivateChatWriteAccessResult =
  | { status: "allowed" }
  | {
      status: "denied";
      reason: TelegramPrivateChatWriteAccessDeniedReason;
    }
  | {
      status: "unavailable";
      reason: TelegramPrivateChatWriteAccessUnavailableReason;
    };

export type TelegramPrivateChatWriteAccessFailure = Exclude<
  TelegramPrivateChatWriteAccessResult,
  { status: "allowed" }
>;

export type TelegramMessageReplyMarkupEditResult =
  | { status: "updated" }
  | { status: "unchanged" }
  | {
      status: "failed";
      reason:
        | "telegram_bot_cannot_edit_channel"
        | "telegram_post_cannot_be_edited"
        | "telegram_button_is_invalid"
        | "telegram_api_rejected_post_edit";
    };

export type TelegramMessageCaptionEditResult =
  | { status: "updated" }
  | { status: "unchanged" }
  | {
      status: "failed";
      reason:
        | "telegram_bot_cannot_edit_channel"
        | "telegram_post_cannot_be_edited"
        | "telegram_caption_is_invalid"
        | "telegram_api_rejected_post_edit";
    };

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getRetryDelayMs = (response: TelegramApiResponse<unknown> | null, attempt: number) => {
  const retryAfter = response && !response.ok ? response.parameters?.retry_after : null;

  if (retryAfter && retryAfter > 0) {
    return Math.min(retryAfter * 1000, 5000);
  }

  return Math.min(400 * 2 ** (attempt - 1), 5000);
};

const getTelegramApiError = (
  method: string,
  status: number,
  description: string | null | undefined,
  attempt: number,
) => {
  const transport = env.telegramProxyUrl ? "proxy" : "direct";
  const error = new Error(
    `Telegram API ${method} failed via ${transport} on attempt ${attempt}/${PREPARED_MESSAGE_MAX_ATTEMPTS} (${status}): ${description || "Unknown error"}`,
  );
  error.name = "TelegramApiError";
  return error;
};

const PRIVATE_CHAT_ACCESS_PROBE_TIMEOUT_MS = 5000;

const telegramPrivateChatNotFoundDescriptions = [
  "chat not found",
  "chat_not_found",
  "user not found",
  "user_not_found",
  "chat_id_invalid",
  "chat id invalid",
  "chat id is invalid",
  "user_id_invalid",
  "user id invalid",
  "user id is invalid",
  "peer_id_invalid",
  "peer id invalid",
  "peer id is invalid",
];

const telegramBotBlockedDescriptions = [
  "bot was blocked",
  "bot is blocked",
  "bot blocked",
  "blocked by the user",
  "user is blocked",
  "user_is_blocked",
  "bot_blocked",
];

const telegramUserDeactivatedDescriptions = [
  "user is deactivated",
  "user deactivated",
  "deactivated user",
  "user_deactivated",
  "input_user_deactivated",
];

const descriptionIncludesAny = (description: string, patterns: string[]) =>
  patterns.some((pattern) => description.includes(pattern));

export const classifyTelegramPrivateChatWriteAccessFailure = ({
  errorCode,
  description,
}: {
  errorCode: number;
  description?: string | null;
}): TelegramPrivateChatWriteAccessFailure => {
  const normalizedDescription = description?.trim().toLowerCase() ?? "";

  if (
    errorCode === 400 &&
    descriptionIncludesAny(
      normalizedDescription,
      telegramPrivateChatNotFoundDescriptions,
    )
  ) {
    return { status: "denied", reason: "chat_not_found" };
  }

  if (errorCode === 403) {
    if (
      descriptionIncludesAny(
        normalizedDescription,
        telegramUserDeactivatedDescriptions,
      )
    ) {
      return { status: "denied", reason: "user_deactivated" };
    }

    if (
      descriptionIncludesAny(
        normalizedDescription,
        telegramBotBlockedDescriptions,
      )
    ) {
      return { status: "denied", reason: "bot_blocked" };
    }

    return { status: "denied", reason: "forbidden" };
  }

  if (errorCode === 429) {
    return { status: "unavailable", reason: "rate_limited" };
  }

  if (errorCode >= 500 && errorCode <= 599) {
    return { status: "unavailable", reason: "telegram_server_error" };
  }

  return { status: "unavailable", reason: "unexpected_response" };
};

type TelegramApiFailureResponse = Extract<
  TelegramApiResponse<unknown>,
  { ok: false }
>;

const parseTelegramApiFailureResponse = (
  value: unknown,
): TelegramApiFailureResponse | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  if (candidate.ok !== false) {
    return null;
  }

  const errorCode = candidate.error_code;
  const description = candidate.description;
  if (
    (errorCode !== undefined &&
      (!Number.isInteger(errorCode) || Number(errorCode) <= 0)) ||
    (description !== undefined && typeof description !== "string") ||
    (errorCode === undefined && description === undefined)
  ) {
    return null;
  }

  const parameters = candidate.parameters;
  if (
    parameters !== undefined &&
    (!parameters || typeof parameters !== "object" || Array.isArray(parameters))
  ) {
    return null;
  }

  const retryAfter = (parameters as Record<string, unknown> | undefined)
    ?.retry_after;
  if (
    retryAfter !== undefined &&
    (!Number.isFinite(retryAfter) || Number(retryAfter) <= 0)
  ) {
    return null;
  }

  return {
    ok: false,
    error_code: errorCode as number | undefined,
    description: description as string | undefined,
    parameters:
      retryAfter === undefined
        ? undefined
        : { retry_after: Number(retryAfter) },
  };
};

const isTelegramApiTrueResponse = (value: unknown) =>
  Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      (value as Record<string, unknown>).ok === true &&
      (value as Record<string, unknown>).result === true,
  );

export const classifyTelegramReplyMarkupEditFailure = (
  description?: string | null,
): TelegramMessageReplyMarkupEditResult => {
  const normalizedDescription = description?.toLowerCase() ?? "";

  if (
    normalizedDescription.includes("message is not modified") ||
    normalizedDescription.includes("message_not_modified")
  ) {
    return { status: "unchanged" };
  }

  if (
    normalizedDescription.includes("chat_admin_required") ||
    normalizedDescription.includes("not enough rights") ||
    normalizedDescription.includes("administrator rights") ||
    normalizedDescription.includes("bot is not a member")
  ) {
    return { status: "failed", reason: "telegram_bot_cannot_edit_channel" };
  }

  if (
    normalizedDescription.includes("message to edit not found") ||
    normalizedDescription.includes("message can't be edited") ||
    normalizedDescription.includes("message cant be edited") ||
    normalizedDescription.includes("message_id_invalid")
  ) {
    return { status: "failed", reason: "telegram_post_cannot_be_edited" };
  }

  if (
    normalizedDescription.includes("button_url_invalid") ||
    normalizedDescription.includes("button_data_invalid") ||
    normalizedDescription.includes("button_type_invalid") ||
    normalizedDescription.includes("url_invalid")
  ) {
    return { status: "failed", reason: "telegram_button_is_invalid" };
  }

  return { status: "failed", reason: "telegram_api_rejected_post_edit" };
};

export const classifyTelegramCaptionEditFailure = (
  description?: string | null,
): TelegramMessageCaptionEditResult => {
  const normalizedDescription = description?.toLowerCase() ?? "";

  if (
    normalizedDescription.includes("can't parse entities") ||
    normalizedDescription.includes("cant parse entities") ||
    normalizedDescription.includes("entity bounds")
  ) {
    return { status: "failed", reason: "telegram_caption_is_invalid" };
  }

  const result = classifyTelegramReplyMarkupEditFailure(description);
  if (result.status !== "failed") {
    return result;
  }

  return {
    status: "failed",
    reason:
      result.reason === "telegram_button_is_invalid"
        ? "telegram_caption_is_invalid"
        : result.reason,
  };
};

export async function probeTelegramPrivateChatWriteAccess({
  telegramUserId,
}: {
  telegramUserId: string | bigint;
}): Promise<TelegramPrivateChatWriteAccessResult> {
  const token = env.telegramBotToken;

  if (!token) {
    return { status: "unavailable", reason: "bot_token_missing" };
  }

  const chatId = telegramUserId.toString().trim();
  if (!/^[1-9]\d*$/.test(chatId)) {
    return { status: "unavailable", reason: "invalid_telegram_user_id" };
  }

  const url = `https://api.telegram.org/bot${token}/sendChatAction`;
  const body = JSON.stringify({
    chat_id: chatId,
    action: "typing",
  });

  for (
    let attempt = 1;
    attempt <= PREPARED_MESSAGE_MAX_ATTEMPTS;
    attempt += 1
  ) {
    let response: Response;

    try {
      response = await proxyFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal: AbortSignal.timeout(PRIVATE_CHAT_ACCESS_PROBE_TIMEOUT_MS),
      });
    } catch {
      if (attempt === PREPARED_MESSAGE_MAX_ATTEMPTS) {
        return { status: "unavailable", reason: "transport_error" };
      }

      await wait(getRetryDelayMs(null, attempt));
      continue;
    }

    const data: unknown = await response.json().catch(() => null);

    if (response.ok && isTelegramApiTrueResponse(data)) {
      return { status: "allowed" };
    }

    const failure = parseTelegramApiFailureResponse(data);
    if (!failure) {
      if (
        attempt < PREPARED_MESSAGE_MAX_ATTEMPTS &&
        RETRYABLE_STATUS_CODES.has(response.status)
      ) {
        await wait(getRetryDelayMs(null, attempt));
        continue;
      }

      return { status: "unavailable", reason: "malformed_response" };
    }

    const errorCode = failure.error_code ?? response.status;
    const result = classifyTelegramPrivateChatWriteAccessFailure({
      errorCode,
      description: failure.description,
    });

    if (result.status === "denied") {
      return result;
    }

    if (
      attempt < PREPARED_MESSAGE_MAX_ATTEMPTS &&
      RETRYABLE_STATUS_CODES.has(errorCode)
    ) {
      await wait(getRetryDelayMs(failure, attempt));
      continue;
    }

    return result;
  }

  return { status: "unavailable", reason: "unexpected_response" };
}

export async function sendTelegramBotMessage({
  chatId,
  text,
  buttons = [],
}: SendTelegramBotMessageParams) {
  const token = env.telegramBotToken;

  if (!token) {
    console.warn("[telegram-bot] skip sendMessage because TELEGRAM_BOT_TOKEN is empty");
    return false;
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const body = JSON.stringify({
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
    reply_markup: buttons.length
      ? { inline_keyboard: buttons.map((button) => [button]) }
      : undefined,
  });

  for (let attempt = 1; attempt <= PREPARED_MESSAGE_MAX_ATTEMPTS; attempt += 1) {
    let response: Response;

    try {
      response = await proxyFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
    } catch (error) {
      if (attempt === PREPARED_MESSAGE_MAX_ATTEMPTS) {
        console.error("[telegram-bot] sendMessage transport failed", { chatId, error });
        return false;
      }
      await wait(getRetryDelayMs(null, attempt));
      continue;
    }

    const data = (await response.json().catch(() => null)) as
      | TelegramApiResponse<TelegramSentMessage>
      | null;

    if (response.ok && data?.ok) {
      return { messageId: data.result.message_id };
    }

    const errorCode = data && !data.ok ? data.error_code : response.status;
    const description = data && !data.ok ? data.description : null;
    console.error("[telegram-bot] sendMessage failed", {
      chatId,
      attempt,
      errorCode,
      description,
    });

    if (
      attempt === PREPARED_MESSAGE_MAX_ATTEMPTS ||
      !RETRYABLE_STATUS_CODES.has(errorCode || response.status)
    ) {
      return false;
    }

    await wait(getRetryDelayMs(data, attempt));
  }

  return false;
}

export async function sendTelegramBotRichMessage({
  chatId,
  html,
}: SendTelegramBotRichMessageParams) {
  const token = env.telegramBotToken;

  if (!token) {
    console.warn("[telegram-bot] skip sendRichMessage because TELEGRAM_BOT_TOKEN is empty");
    return false;
  }

  try {
    const response = await proxyFetch(
      `https://api.telegram.org/bot${token}/sendRichMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          rich_message: { html },
        }),
      },
    );
    const data = (await response.json().catch(() => null)) as
      | TelegramApiResponse<TelegramSentMessage>
      | null;

    if (response.ok && data?.ok) {
      return { messageId: data.result.message_id };
    }

    console.error("[telegram-bot] sendRichMessage failed", {
      chatId,
      errorCode: data && !data.ok ? data.error_code : response.status,
      description: data && !data.ok ? data.description : null,
    });
  } catch (error) {
    console.error("[telegram-bot] sendRichMessage transport failed", {
      chatId,
      error,
    });
  }

  return false;
}

export async function sendTelegramBotRichVideoMessage({
  chatId,
  html,
  video,
  filename,
  mediaId,
  attachmentName,
  width,
  height,
  duration,
}: SendTelegramBotRichVideoMessageParams) {
  const token = env.telegramBotToken;

  if (!token) {
    console.warn(
      "[telegram-bot] skip rich video because TELEGRAM_BOT_TOKEN is empty",
    );
    return false;
  }

  const richMessage = buildTelegramRichVideoInput({
    html,
    mediaId,
    attachmentName,
    width,
    height,
    duration,
  });
  const formData = createProxyFormData();
  formData.append("chat_id", chatId);
  formData.append("rich_message", JSON.stringify(richMessage));
  formData.append(
    attachmentName,
    new Blob([Uint8Array.from(video)], { type: "video/mp4" }),
    filename,
  );

  try {
    const response = await proxyFetch(
      `https://api.telegram.org/bot${token}/sendRichMessage`,
      {
        method: "POST",
        body: formData,
      },
    );
    const data = (await response.json().catch(() => null)) as
      | TelegramApiResponse<TelegramSentMessage>
      | null;

    if (response.ok && data?.ok) {
      return { messageId: data.result.message_id };
    }

    console.error("[telegram-bot] rich video failed", {
      chatId,
      errorCode: data && !data.ok ? data.error_code : response.status,
      description: data && !data.ok ? data.description : null,
    });
  } catch (error) {
    console.error("[telegram-bot] rich video transport failed", {
      chatId,
      error,
    });
  }

  return false;
}

async function editTelegramMessage<
  TResult extends { status: "updated" | "unchanged" | "failed" },
>({
  method,
  chatId,
  messageId,
  payload,
  classifyFailure,
  updatedResult,
}: {
  method: "editMessageCaption" | "editMessageReplyMarkup";
  chatId: string;
  messageId: number;
  payload: Record<string, unknown>;
  classifyFailure: (description?: string | null) => TResult;
  updatedResult: TResult;
}): Promise<TResult> {
  const token = env.telegramBotToken;

  if (!token) {
    console.warn(`[telegram-bot] skip ${method} because TELEGRAM_BOT_TOKEN is empty`);
    return classifyFailure();
  }

  const url = `https://api.telegram.org/bot${token}/${method}`;
  const body = JSON.stringify({
    chat_id: chatId,
    message_id: messageId,
    ...payload,
  });

  for (let attempt = 1; attempt <= PREPARED_MESSAGE_MAX_ATTEMPTS; attempt += 1) {
    let response: Response;

    try {
      response = await proxyFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
    } catch (error) {
      if (attempt === PREPARED_MESSAGE_MAX_ATTEMPTS) {
        console.error(`[telegram-bot] ${method} transport failed`, {
          chatId,
          messageId,
          error,
        });
        return classifyFailure();
      }

      await wait(getRetryDelayMs(null, attempt));
      continue;
    }

    const data = (await response.json().catch(() => null)) as
      | TelegramApiResponse<unknown>
      | null;

    if (response.ok && data?.ok) {
      return updatedResult;
    }

    const errorCode = data && !data.ok ? data.error_code : response.status;
    const description = data && !data.ok ? data.description : null;
    console.error(`[telegram-bot] ${method} failed`, {
      chatId,
      messageId,
      attempt,
      errorCode,
      description,
    });

    if (
      attempt === PREPARED_MESSAGE_MAX_ATTEMPTS ||
      !RETRYABLE_STATUS_CODES.has(errorCode || response.status)
    ) {
      return classifyFailure(description);
    }

    await wait(getRetryDelayMs(data, attempt));
  }

  return classifyFailure();
}

export async function editTelegramMessageReplyMarkup({
  chatId,
  messageId,
  inlineKeyboard,
}: {
  chatId: string;
  messageId: number;
  inlineKeyboard: TelegramInlineKeyboard;
}): Promise<TelegramMessageReplyMarkupEditResult> {
  return editTelegramMessage({
    method: "editMessageReplyMarkup",
    chatId,
    messageId,
    payload: { reply_markup: { inline_keyboard: inlineKeyboard } },
    classifyFailure: classifyTelegramReplyMarkupEditFailure,
    updatedResult: { status: "updated" },
  });
}

export async function editTelegramMessageCaption({
  chatId,
  messageId,
  captionHtml,
  showCaptionAboveMedia,
}: {
  chatId: string;
  messageId: number;
  captionHtml: string;
  showCaptionAboveMedia: boolean;
}): Promise<TelegramMessageCaptionEditResult> {
  return editTelegramMessage({
    method: "editMessageCaption",
    chatId,
    messageId,
    payload: {
      caption: captionHtml,
      parse_mode: "HTML",
      show_caption_above_media: showCaptionAboveMedia,
    },
    classifyFailure: classifyTelegramCaptionEditFailure,
    updatedResult: { status: "updated" },
  });
}

export const canTelegramChatMemberEditChannel = (
  member: TelegramChatMember,
) =>
  member.status === "creator" ||
  (member.status === "administrator" &&
    "can_edit_messages" in member &&
    member.can_edit_messages === true);

export async function checkTelegramChannelEditorAccess({
  chatId,
  telegramUserId,
}: {
  chatId: string;
  telegramUserId: bigint;
}): Promise<TelegramChannelEditorAccessResult> {
  const token = env.telegramBotToken;
  const userId = Number(telegramUserId);

  if (!token || !Number.isSafeInteger(userId) || userId <= 0) {
    return {
      allowed: false,
      reason: "telegram_channel_access_could_not_be_verified",
    };
  }

  const url = `https://api.telegram.org/bot${token}/getChatMember`;
  const body = JSON.stringify({ chat_id: chatId, user_id: userId });

  for (let attempt = 1; attempt <= PREPARED_MESSAGE_MAX_ATTEMPTS; attempt += 1) {
    let response: Response;

    try {
      response = await proxyFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
    } catch (error) {
      if (attempt === PREPARED_MESSAGE_MAX_ATTEMPTS) {
        console.error("[telegram-bot] getChatMember transport failed", {
          chatId,
          userId,
          error,
        });
        break;
      }

      await wait(getRetryDelayMs(null, attempt));
      continue;
    }

    const data = (await response.json().catch(() => null)) as
      | TelegramApiResponse<TelegramChatMember>
      | null;

    if (response.ok && data?.ok) {
      return canTelegramChatMemberEditChannel(data.result)
        ? { allowed: true }
        : {
            allowed: false,
            reason: "telegram_user_cannot_edit_channel",
          };
    }

    const errorCode = data && !data.ok ? data.error_code : response.status;
    const description = data && !data.ok ? data.description : null;
    console.error("[telegram-bot] getChatMember failed", {
      chatId,
      userId,
      attempt,
      errorCode,
      description,
    });

    if (
      attempt === PREPARED_MESSAGE_MAX_ATTEMPTS ||
      !RETRYABLE_STATUS_CODES.has(errorCode || response.status)
    ) {
      break;
    }

    await wait(getRetryDelayMs(data, attempt));
  }

  return {
    allowed: false,
    reason: "telegram_channel_access_could_not_be_verified",
  };
}

export async function checkTelegramChannelBotEditorAccess({
  chatId,
}: {
  chatId: string;
}): Promise<TelegramChannelBotEditorAccessResult> {
  const token = env.telegramBotToken;

  if (!token) {
    return {
      allowed: false,
      reason: "telegram_bot_access_could_not_be_verified",
    };
  }

  const url = `https://api.telegram.org/bot${token}/getMe`;

  for (let attempt = 1; attempt <= PREPARED_MESSAGE_MAX_ATTEMPTS; attempt += 1) {
    let response: Response;

    try {
      response = await proxyFetch(url, { method: "POST" });
    } catch (error) {
      if (attempt === PREPARED_MESSAGE_MAX_ATTEMPTS) {
        console.error("[telegram-bot] getMe transport failed", { error });
        break;
      }

      await wait(getRetryDelayMs(null, attempt));
      continue;
    }

    const data = (await response.json().catch(() => null)) as
      | TelegramApiResponse<TelegramBotUser>
      | null;

    if (response.ok && data?.ok && Number.isSafeInteger(data.result.id)) {
      const access = await checkTelegramChannelEditorAccess({
        chatId,
        telegramUserId: BigInt(data.result.id),
      });

      return access.allowed
        ? { allowed: true }
        : {
            allowed: false,
            reason:
              access.reason === "telegram_user_cannot_edit_channel"
                ? "telegram_bot_cannot_edit_channel"
                : "telegram_bot_access_could_not_be_verified",
          };
    }

    const errorCode = data && !data.ok ? data.error_code : response.status;
    const description = data && !data.ok ? data.description : null;
    console.error("[telegram-bot] getMe failed", {
      attempt,
      errorCode,
      description,
    });

    if (
      attempt === PREPARED_MESSAGE_MAX_ATTEMPTS ||
      !RETRYABLE_STATUS_CODES.has(errorCode || response.status)
    ) {
      break;
    }

    await wait(getRetryDelayMs(data, attempt));
  }

  return {
    allowed: false,
    reason: "telegram_bot_access_could_not_be_verified",
  };
}

export async function savePreparedInlineMessage({
  telegramUserId,
  result,
}: SavePreparedInlineMessageParams): Promise<PreparedInlineMessage> {
  const token = env.requireTelegramBotToken();
  const url = `https://api.telegram.org/bot${token}/savePreparedInlineMessage`;
  const body = JSON.stringify({
    user_id: Number(telegramUserId),
    result,
    allow_user_chats: true,
    allow_bot_chats: true,
    allow_group_chats: true,
    allow_channel_chats: true,
  });
  let lastError: unknown;

  for (let attempt = 1; attempt <= PREPARED_MESSAGE_MAX_ATTEMPTS; attempt += 1) {
    let response: Response;

    try {
      response = await proxyFetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body,
      });
    } catch (error) {
      lastError = error;

      if (attempt === PREPARED_MESSAGE_MAX_ATTEMPTS) {
        throw error;
      }

      await wait(getRetryDelayMs(null, attempt));
      continue;
    }

    const data = (await response.json().catch(() => null)) as
      | TelegramApiResponse<PreparedInlineMessage>
      | null;

    if (response.ok && data?.ok) {
      return data.result;
    }

    const errorCode = data && !data.ok ? data.error_code : response.status;
    const description = data && !data.ok ? data.description : null;
    lastError = getTelegramApiError(
      "savePreparedInlineMessage",
      errorCode || response.status,
      description,
      attempt,
    );

    if (
      attempt === PREPARED_MESSAGE_MAX_ATTEMPTS ||
      !RETRYABLE_STATUS_CODES.has(errorCode || response.status)
    ) {
      throw lastError;
    }

    await wait(getRetryDelayMs(data, attempt));
  }

  throw lastError;
}
