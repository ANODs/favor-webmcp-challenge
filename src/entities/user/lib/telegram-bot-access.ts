export const TELEGRAM_BOT_ACCESS_ERROR_CODES = {
  chatRequired: "TELEGRAM_BOT_CHAT_REQUIRED",
  unavailable: "TELEGRAM_BOT_ACCESS_UNAVAILABLE",
  contractAuthorUnavailable: "CONTRACT_AUTHOR_BOT_UNAVAILABLE",
} as const;

export type TelegramBotAccessErrorCode =
  (typeof TELEGRAM_BOT_ACCESS_ERROR_CODES)[keyof typeof TELEGRAM_BOT_ACCESS_ERROR_CODES];

export const isTelegramBotChatRequiredError = (code?: string) =>
  code === TELEGRAM_BOT_ACCESS_ERROR_CODES.chatRequired;
