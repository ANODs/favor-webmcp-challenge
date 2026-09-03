import { BotStatus } from "@prisma/client";

import {
  normalizeDealBriefResources,
  type DealDto,
} from "@/entities/deal";
import { env } from "@/shared/config/env";
import { prisma } from "@/shared/lib/prisma";
import {
  normalizeTelegramMessageLocale,
  type TelegramMessageLocale,
} from "@/shared/lib/telegram/locale.server";
import {
  TELEGRAM_MINI_APP_START_PARAMS,
  buildDealStartParam,
  buildContractStartParam,
  buildTelegramMiniAppUrl,
  sendTelegramBotMessage,
  buildTelegramUserUrl,
} from "@/shared/lib/telegram";

import {
  getDealNotificationStatusLabel,
  renderDealNotificationMessage,
} from "./messages";

type DealNotificationParticipant = {
  id: number;
  name: string | null;
  telegramId: string | bigint;
  telegramUsername: string | null;
};

type DealNotificationContract = {
  id: number;
  slug: string;
  titleRu: string | null;
  titleEn: string | null;
};

type DealNotificationDeal = {
  id: number;
  status: DealDto["status"];
  isEscrow?: boolean;
  escrowVersion?: number;
  contract: DealNotificationContract | null;
  contractSnapshot?: unknown;
  customer: DealNotificationParticipant;
  freelancer: DealNotificationParticipant;
};

const getParticipantLabel = (
  participant: DealNotificationParticipant,
  locale: TelegramMessageLocale,
) =>
  participant.telegramUsername
    ? `@${participant.telegramUsername}`
    : participant.name ||
      renderDealNotificationMessage(locale, "participantFallback", {
        id: participant.id,
      });

const getCounterpart = (deal: DealNotificationDeal, userId: number) =>
  deal.customer.id === userId ? deal.freelancer : deal.customer;

const getDealButtons = (
  deal: DealNotificationDeal,
  recipientId: number,
  locale: TelegramMessageLocale,
) => {
  const counterpart = getCounterpart(deal, recipientId);
  const buttons = [
    {
      text: renderDealNotificationMessage(locale, "openDeal"),
      url: buildTelegramMiniAppUrl(env.telegramBotUsername, buildDealStartParam(deal.id)),
    },
  ];

  const counterpartUrl = buildTelegramUserUrl({
    telegramUsername: counterpart.telegramUsername,
    telegramId: counterpart.telegramId,
  });

  if (counterpartUrl) {
    buttons.push({
      text: renderDealNotificationMessage(locale, "contactCounterpart"),
      url: counterpartUrl,
    });
  }

  buttons.push({
    text: renderDealNotificationMessage(locale, "openMiniApp"),
    url: buildTelegramMiniAppUrl(
      env.telegramBotUsername,
      TELEGRAM_MINI_APP_START_PARAMS.deals,
    ),
  });

  return buttons;
};

const getContractTitle = (deal: DealNotificationDeal, locale: TelegramMessageLocale) => {
  const localizedTitle = deal.contract
    ? locale === "en"
      ? deal.contract.titleEn || deal.contract.titleRu
      : deal.contract.titleRu || deal.contract.titleEn
    : null;

  const snapshotTitle =
    deal.contractSnapshot &&
    typeof deal.contractSnapshot === "object" &&
    "title" in deal.contractSnapshot &&
    typeof deal.contractSnapshot.title === "string"
      ? deal.contractSnapshot.title
      : null;

  return (
    localizedTitle ??
    snapshotTitle ??
    renderDealNotificationMessage(locale, "deletedContract")
  );
};

async function getRecipientLocales(recipients: DealNotificationParticipant[]) {
  const users = await prisma.user.findMany({
    where: { id: { in: [...new Set(recipients.map(({ id }) => id))] } },
    select: { id: true, languageCode: true },
  });

  return new Map<number, TelegramMessageLocale>(
    users.map(({ id, languageCode }) => [
      id,
      normalizeTelegramMessageLocale(languageCode) ?? "ru",
    ]),
  );
}

async function deliverDealNotification(
  deal: DealNotificationDeal,
  notifications: Array<{
    recipient: DealNotificationParticipant;
    text: string | ((locale: TelegramMessageLocale) => string);
  }>,
) {
  const locales = await getRecipientLocales(notifications.map(({ recipient }) => recipient));
  const results = await Promise.allSettled(
    notifications.map(({ recipient, text }) => {
      const locale = locales.get(recipient.id) ?? "ru";

      return sendTelegramBotMessage({
        chatId: recipient.telegramId.toString(),
        text: typeof text === "function" ? text(locale) : text,
        buttons: getDealButtons(deal, recipient.id, locale),
      });
    }),
  );

  const hasSuccessfulDelivery = results.some(
    (result) => result.status === "fulfilled" && result.value,
  );

  await prisma.communication.updateMany({
    where: {
      dealId: deal.id,
    },
    data: {
      botStatus: hasSuccessfulDelivery ? BotStatus.active : BotStatus.failed,
    },
  });

  return hasSuccessfulDelivery;
}

export async function notifyDealCreated(
  deal: DealNotificationDeal & {
    details: string;
    price: number | import("@prisma/client/runtime/library").Decimal;
    deadlineDays: number | null;
    briefResources?: unknown;
  },
) {
  const counterpartForCustomer = getCounterpart(deal, deal.customer.id);
  const counterpartForFreelancer = getCounterpart(deal, deal.freelancer.id);

  const buildDealInfoText = (locale: TelegramMessageLocale) => {
    const contractTitle = getContractTitle(deal, locale);
    const deadlineText = deal.deadlineDays
      ? renderDealNotificationMessage(locale, "deadlineDays", {
          days: deal.deadlineDays,
        })
      : renderDealNotificationMessage(locale, "deadlineNotSpecified");
    const materialCount = normalizeDealBriefResources(
      deal.briefResources,
    ).length;
    const materialsText = materialCount
      ? renderDealNotificationMessage(locale, "projectMaterialsCount", {
          count: materialCount,
        })
      : renderDealNotificationMessage(locale, "projectMaterialsNone");

    return renderDealNotificationMessage(locale, "dealInfo", {
      contractTitle,
      details: deal.details,
      price: deal.price.toString(),
      deadline: deadlineText,
      materials: materialsText,
    });
  };

  await deliverDealNotification(deal, [
    {
      recipient: deal.customer,
      text: (locale) => {
        const contractTitle = getContractTitle(deal, locale);

        return renderDealNotificationMessage(locale, "dealCreatedCustomer", {
          dealId: deal.id,
          contractTitle,
          counterpart: getParticipantLabel(counterpartForCustomer, locale),
          dealInfo: buildDealInfoText(locale),
        });
      },
    },
    {
      recipient: deal.freelancer,
      text: (locale) => {
        const contractTitle = getContractTitle(deal, locale);

        return renderDealNotificationMessage(locale, "dealCreatedFreelancer", {
          dealId: deal.id,
          contractTitle,
          counterpart: getParticipantLabel(counterpartForFreelancer, locale),
          dealInfo: buildDealInfoText(locale),
        });
      },
    },
  ]);
}

export async function notifyDealStatusChanged({
  deal,
  actorUserId,
  previousStatus,
}: {
  deal: DealNotificationDeal;
  actorUserId: number;
  previousStatus: DealDto["status"];
}) {
  const recipient = getCounterpart(deal, actorUserId);
  const actor = getCounterpart(deal, recipient.id);
  if (deal.status === "in_progress") {
    await deliverDealNotification(deal, [
      {
        recipient: deal.freelancer,
        text: (locale) =>
          renderDealNotificationMessage(locale, "escrowFundedFreelancer", {
            customer: getParticipantLabel(deal.customer, locale),
            dealId: deal.id,
            contractTitle: getContractTitle(deal, locale),
          }),
      },
      {
        recipient: deal.customer,
        text: (locale) =>
          renderDealNotificationMessage(locale, "escrowFundedCustomer", {
            dealId: deal.id,
            contractTitle: getContractTitle(deal, locale),
          }),
      },
    ]);
    return;
  }

  await deliverDealNotification(deal, [
    {
      recipient,
      text: (locale) =>
        renderDealNotificationMessage(locale, "statusChanged", {
          actor: getParticipantLabel(actor, locale),
          dealId: deal.id,
          previousStatus: getDealNotificationStatusLabel(locale, previousStatus),
          nextStatus: getDealNotificationStatusLabel(locale, deal.status),
          contractTitle: getContractTitle(deal, locale),
        }),
    },
  ]);
}

export async function notifyDealReviewSaved({
  deal,
  actorUserId,
  becameCompleted,
}: {
  deal: DealNotificationDeal;
  actorUserId: number;
  becameCompleted: boolean;
}) {
  const actor = deal.customer.id === actorUserId ? deal.customer : deal.freelancer;
  const counterpart = getCounterpart(deal, actorUserId);

  const notifications: Array<{
    recipient: DealNotificationParticipant;
    text: (locale: TelegramMessageLocale) => string;
  }> = becameCompleted
    ? [
        {
          recipient: deal.customer,
          text: (locale) =>
            renderDealNotificationMessage(locale, "dealCompleted", {
              dealId: deal.id,
              contractTitle: getContractTitle(deal, locale),
            }),
        },
        {
          recipient: deal.freelancer,
          text: (locale) =>
            renderDealNotificationMessage(locale, "dealCompleted", {
              dealId: deal.id,
              contractTitle: getContractTitle(deal, locale),
            }),
        },
      ]
    : [
        {
          recipient: counterpart,
          text: (locale) =>
            renderDealNotificationMessage(locale, "reviewSaved", {
              actor: getParticipantLabel(actor, locale),
              dealId: deal.id,
            }),
        },
      ];

  await deliverDealNotification(deal, notifications);
}

export async function notifyDealPaymentExpiring({
  deal,
  hoursLeft = 2,
}: {
  deal: DealNotificationDeal;
  hoursLeft?: number;
}) {
  return deliverDealNotification(deal, [
    {
      recipient: deal.customer,
      text: (locale) =>
        renderDealNotificationMessage(locale, "paymentExpiring", {
          dealId: deal.id,
          contractTitle: getContractTitle(deal, locale),
          hoursLeft,
        }),
    },
  ]);
}

export async function notifyDealPaymentExpired({
  deal,
}: {
  deal: DealNotificationDeal;
}) {
  const locales = await getRecipientLocales([deal.customer, deal.freelancer]);

  const deliverWithContractLink = async (recipient: DealNotificationParticipant) => {
    const locale = locales.get(recipient.id) ?? "ru";
    const buttons = [
      {
        text: renderDealNotificationMessage(locale, "openDeal"),
        url: buildTelegramMiniAppUrl(env.telegramBotUsername, buildDealStartParam(deal.id)),
      },
    ];

    if (deal.contract?.slug) {
      buttons.push({
        text: renderDealNotificationMessage(locale, "openContract"),
        url: buildTelegramMiniAppUrl(
          env.telegramBotUsername,
          buildContractStartParam(deal.contract.slug),
        ),
      });
    }

    const text = renderDealNotificationMessage(locale, "paymentExpired", {
      dealId: deal.id,
      contractTitle: getContractTitle(deal, locale),
    });

    await sendTelegramBotMessage({
      chatId: recipient.telegramId.toString(),
      text,
      buttons,
    });
  };

  await Promise.allSettled([
    deliverWithContractLink(deal.customer),
    deliverWithContractLink(deal.freelancer),
  ]);

  await prisma.communication.updateMany({
    where: { dealId: deal.id },
    data: { botStatus: BotStatus.active },
  });
}

export async function notifyDealDeadlineApproaching({
  deal,
  hoursLeft = 24,
}: {
  deal: DealNotificationDeal;
  hoursLeft?: number;
}) {
  return deliverDealNotification(deal, [
    {
      recipient: deal.freelancer,
      text: (locale) =>
        renderDealNotificationMessage(locale, "deadlineApproaching", {
          dealId: deal.id,
          contractTitle: getContractTitle(deal, locale),
          hoursLeft,
        }),
    },
  ]);
}

export async function notifyDealOverdue({
  deal,
  notifyCustomer = true,
  notifyFreelancer = true,
}: {
  deal: DealNotificationDeal;
  notifyCustomer?: boolean;
  notifyFreelancer?: boolean;
}) {
  const customerMessageKey = deal.isEscrow
    ? (deal.escrowVersion ?? 1) >= 2
      ? "overdueEscrowCustomer"
      : "overdueLegacyEscrowCustomer"
    : "overdueDirectCustomer";
  const [freelancerSent, customerSent] = await Promise.all([
    notifyFreelancer
      ? deliverDealNotification(deal, [
      {
        recipient: deal.freelancer,
        text: (locale) =>
          renderDealNotificationMessage(locale, "overdueFreelancer", {
            dealId: deal.id,
            contractTitle: getContractTitle(deal, locale),
          }),
      },
        ])
      : Promise.resolve(false),
    notifyCustomer
      ? deliverDealNotification(deal, [
      {
        recipient: deal.customer,
        text: (locale) =>
          renderDealNotificationMessage(locale, customerMessageKey, {
            dealId: deal.id,
            contractTitle: getContractTitle(deal, locale),
          }),
      },
        ])
      : Promise.resolve(false),
  ]);

  return { freelancerSent, customerSent };
}
