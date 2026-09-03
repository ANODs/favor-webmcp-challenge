import crypto from "node:crypto";

import { env } from "@/shared/config/env";
import { buildContractStartParam, buildTelegramMiniAppUrl } from "@/shared/lib/telegram";
import { sendTelegramBotMessage } from "@/shared/lib/telegram/bot";
import {
  normalizeTelegramMessageLocale,
  type TelegramMessageLocale,
} from "@/shared/lib/telegram/locale.server";
import englishMessages from "./messages.en.json";
import russianMessages from "./messages.ru.json";

type QuestionNotificationContract = {
  slug: string;
  titleRu: string | null;
  titleEn: string | null;
  author: {
    telegramId: bigint;
    languageCode: string | null;
  };
};

const getMessages = (locale: TelegramMessageLocale) =>
  locale === "en" ? englishMessages : russianMessages;

const formatMessage = (
  template: string,
  values: Record<string, string | number>,
) =>
  Object.entries(values).reduce(
    (message, [key, value]) => message.replaceAll(`{${key}}`, String(value)),
    template,
  );

export const buildContractQuestionFingerprint = (question: string) =>
  crypto
    .createHash("sha256")
    .update(question.trim().replace(/\s+/g, " ").toLocaleLowerCase("ru"))
    .digest("hex");

const getLocalizedTitle = (
  contract: QuestionNotificationContract,
  locale: TelegramMessageLocale,
) => {
  const messages = getMessages(locale);
  return (
    (locale === "en"
      ? contract.titleEn || contract.titleRu
      : contract.titleRu || contract.titleEn) || messages.contractFallback
  );
};

export async function notifyContractAuthorAboutQuestion({
  questionId,
  question,
  contract,
}: {
  questionId: number;
  question: string;
  contract: QuestionNotificationContract;
}) {
  const locale = normalizeTelegramMessageLocale(contract.author.languageCode) ?? "ru";
  const messages = getMessages(locale);
  const title = getLocalizedTitle(contract, locale);
  const text = formatMessage(messages.newQuestion, { title, question });

  return sendTelegramBotMessage({
    chatId: contract.author.telegramId.toString(),
    text,
    buttons: [
      {
        text: messages.reply,
        callback_data: `cq:answer:${questionId}`,
      },
      {
        text: messages.dismiss,
        callback_data: `cq:dismiss:${questionId}`,
      },
      {
        text: messages.openContract,
        url: buildTelegramMiniAppUrl(
          env.telegramBotUsername,
          buildContractStartParam(contract.slug),
        ),
      },
    ],
  });
}
