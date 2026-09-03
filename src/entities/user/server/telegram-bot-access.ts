import { ApplicationError } from "@/shared/lib/application-error";
import {
  probeTelegramPrivateChatWriteAccess,
  type TelegramPrivateChatWriteAccessResult,
} from "@/shared/lib/telegram/server";

import { TELEGRAM_BOT_ACCESS_ERROR_CODES } from "../lib/telegram-bot-access";

export type TelegramBotAccessSubject = "current_user" | "contract_author";

export const getTelegramBotAccessError = (
  result: TelegramPrivateChatWriteAccessResult,
  subject: TelegramBotAccessSubject = "current_user",
) => {
  if (result.status === "allowed") {
    return null;
  }

  if (result.status === "unavailable") {
    return new ApplicationError(
      TELEGRAM_BOT_ACCESS_ERROR_CODES.unavailable,
      "Favor bot availability could not be verified.",
      503,
    );
  }

  if (subject === "contract_author") {
    return new ApplicationError(
      TELEGRAM_BOT_ACCESS_ERROR_CODES.contractAuthorUnavailable,
      "The contract author is currently unavailable for Favor notifications.",
      409,
    );
  }

  return new ApplicationError(
    TELEGRAM_BOT_ACCESS_ERROR_CODES.chatRequired,
    "Open the Favor bot chat and press Start to enable notifications.",
    403,
  );
};

export async function assertTelegramBotWriteAccess(
  telegramUserId: string | bigint,
  subject: TelegramBotAccessSubject = "current_user",
) {
  const result = await probeTelegramPrivateChatWriteAccess({ telegramUserId });
  const error = getTelegramBotAccessError(result, subject);

  if (error) {
    throw error;
  }
}
