class TelegramApiError extends Error {
  constructor(method, errorCode, description, parameters) {
    super(`Telegram API ${method} failed with ${errorCode}: ${description}`);
    this.name = "TelegramApiError";
    this.method = method;
    this.errorCode = errorCode;
    this.description = description;
    this.parameters = parameters;
  }
}

function isExpiredInlineQueryError(error) {
  if (
    !(error instanceof TelegramApiError) ||
    error.method !== "answerInlineQuery" ||
    error.errorCode !== 400
  ) {
    return false;
  }

  const description = error.description.toLowerCase();

  return (
    description.includes("query is too old and response timeout expired") ||
    description.includes("query id is invalid")
  );
}

function isExpiredPreCheckoutQueryError(error) {
  if (
    !(error instanceof TelegramApiError) ||
    error.method !== "answerPreCheckoutQuery" ||
    error.errorCode !== 400
  ) {
    return false;
  }

  const description = error.description.toLowerCase();

  return (
    description.includes("query is too old and response timeout expired") ||
    description.includes("query id is invalid")
  );
}

module.exports = {
  TelegramApiError,
  isExpiredInlineQueryError,
  isExpiredPreCheckoutQueryError,
};
