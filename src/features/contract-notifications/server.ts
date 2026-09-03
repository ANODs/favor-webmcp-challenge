import { ContractStatus } from "@prisma/client";

import { env } from "@/shared/config/env";
import { prisma } from "@/shared/lib/prisma";
import {
  buildContractStartParam,
  buildTelegramMiniAppUrl,
  sendTelegramBotMessage,
} from "@/shared/lib/telegram";
import {
  normalizeTelegramMessageLocale,
  type TelegramMessageLocale,
} from "@/shared/lib/telegram/locale.server";
import englishMessages from "./messages.en.json";
import russianMessages from "./messages.ru.json";

type ContractNotificationParticipant = {
  id: number;
  telegramId: string | bigint;
};

type ContractNotificationData = {
  id: number;
  slug: string;
  titleRu: string | null;
  titleEn: string | null;
  status: ContractStatus;
  author: ContractNotificationParticipant;
  scout: ContractNotificationParticipant | null;
};

type ContractNotificationMessages = Omit<typeof englishMessages, "statuses"> & {
  statuses: Record<ContractStatus, string>;
};

const getMessages = (locale: TelegramMessageLocale) =>
  (locale === "en" ? englishMessages : russianMessages) as ContractNotificationMessages;

const formatMessage = (
  template: string,
  values: Record<string, string | number>,
) =>
  Object.entries(values).reduce(
    (message, [key, value]) => message.replaceAll(`{${key}}`, String(value)),
    template,
  );

const getContractStatusLabel = (status: ContractStatus, locale: TelegramMessageLocale) =>
  getMessages(locale).statuses[status] ?? status;

const getContractTitle = (
  contract: ContractNotificationData,
  locale: TelegramMessageLocale,
) => {
  const messages = getMessages(locale);
  return (
    (locale === "en"
      ? contract.titleEn || contract.titleRu
      : contract.titleRu || contract.titleEn) ||
    formatMessage(messages.contractFallback, { id: contract.id })
  );
};

export async function notifyContractStatusChanged({
  contract,
  previousStatus,
}: {
  contract: ContractNotificationData;
  previousStatus: ContractStatus;
}) {
  if (contract.status === previousStatus) return;

  const participants = [contract.author, contract.scout].filter(
    (participant): participant is ContractNotificationParticipant => Boolean(participant),
  );
  const users = await prisma.user.findMany({
    where: { id: { in: participants.map(({ id }) => id) } },
    select: { id: true, languageCode: true },
  });
  const locales = new Map<number, TelegramMessageLocale>(
    users.map(({ id, languageCode }) => [
      id,
      normalizeTelegramMessageLocale(languageCode) ?? "ru",
    ]),
  );

  const sendNotification = async (
    participant: ContractNotificationParticipant,
    isScout: boolean,
  ) => {
    const locale = locales.get(participant.id) ?? "ru";
    const title = getContractTitle(contract, locale);
    const statusOld = getContractStatusLabel(previousStatus, locale);
    const statusNew = getContractStatusLabel(contract.status, locale);
    const messages = getMessages(locale);
    const text = formatMessage(
      isScout ? messages.scoutStatusChanged : messages.authorStatusChanged,
      { title, previousStatus: statusOld, nextStatus: statusNew },
    );

    return sendTelegramBotMessage({
      chatId: participant.telegramId.toString(),
      text,
      buttons: [
        {
          text: messages.openContract,
          url: buildTelegramMiniAppUrl(
            env.telegramBotUsername,
            buildContractStartParam(contract.slug),
          ),
        },
      ],
    });
  };

  await sendNotification(contract.author, false).catch(() => {
    // Ignore errors for individual messages to not break the flow
  });

  if (contract.scout) {
    await sendNotification(contract.scout, true).catch(() => {
      // Ignore errors
    });
  }
}
