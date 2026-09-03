/* eslint-disable @typescript-eslint/no-require-imports */
const { prisma } = require("../../shared/lib/prisma");
const { botText } = require("../../shared/lib/copy");
const {
  parseSubscriptionDuration,
  resolveSubscriptionPeriod,
} = require("../../../../src/shared/lib/subscription/runtime.cjs");

const PREMIUM_SUBSCRIPTION_PAYLOAD_PREFIX = "favor-premium:";
const PAYMENT_USER_SELECT = {
  id: true,
  telegramId: true,
  telegramUsername: true,
  telegramFirstName: true,
  telegramLastName: true,
  languageCode: true,
  name: true,
  premiumExpiresAt: true,
};

function isPremiumPayload(payload) {
  return typeof payload === "string" && payload.startsWith(PREMIUM_SUBSCRIPTION_PAYLOAD_PREFIX);
}

function invalidPayment(locale, copyKey) {
  return { ok: false, errorMessage: botText(locale, `payment.${copyKey}`) };
}

function getIntentDuration(intent) {
  const metadata =
    intent.metadata && typeof intent.metadata === "object" ? intent.metadata : {};

  return parseSubscriptionDuration(metadata.duration);
}

async function findStarsIntent(reference, database = prisma) {
  return database.paymentIntent.findUnique({
    where: { reference },
    include: {
      user: { select: PAYMENT_USER_SELECT },
      beneficiary: { select: PAYMENT_USER_SELECT },
    },
  });
}

async function validatePreCheckoutQuery(preCheckoutQuery, locale = "ru", dependencies = {}) {
  if (!isPremiumPayload(preCheckoutQuery.invoice_payload)) {
    return invalidPayment(locale, "unknownType");
  }
  if (preCheckoutQuery.currency !== "XTR") {
    return invalidPayment(locale, "starsOnly");
  }
  if (typeof preCheckoutQuery.id !== "string" || !preCheckoutQuery.id) {
    return invalidPayment(locale, "invalidInvoice");
  }

  const database = dependencies.prisma || prisma;
  const now = dependencies.now ? dependencies.now() : new Date();
  const intent = await findStarsIntent(preCheckoutQuery.invoice_payload, database);
  const isUnclaimed =
    intent?.status === "created" && intent.providerSubmissionId === null;
  const isSameClaim =
    intent?.status === "submitted" &&
    intent.providerSubmissionId === preCheckoutQuery.id;
  if (
    !intent ||
    intent.provider !== "telegram_stars" ||
    intent.asset !== "XTR" ||
    intent.product !== "subscription" ||
    (!isUnclaimed && !isSameClaim) ||
    intent.expiresAt <= now ||
    intent.user.telegramId !== BigInt(preCheckoutQuery.from.id) ||
    Number(intent.amountNano.toFixed(0)) !== preCheckoutQuery.total_amount
  ) {
    return invalidPayment(locale, "invalidInvoice");
  }

  try {
    getIntentDuration(intent);
  } catch {
    return invalidPayment(locale, "invalidInvoice");
  }

  if (isSameClaim) return { ok: true };

  const claim = await database.paymentIntent.updateMany({
    where: {
      id: intent.id,
      status: "created",
      providerSubmissionId: null,
    },
    data: {
      status: "submitted",
      submittedAt: now,
      providerSubmissionId: preCheckoutQuery.id,
    },
  });
  if (claim.count === 1) return { ok: true };

  const racedIntent = await findStarsIntent(preCheckoutQuery.invoice_payload, database);
  if (
    racedIntent?.status === "submitted" &&
    racedIntent.providerSubmissionId === preCheckoutQuery.id
  ) {
    return { ok: true };
  }

  return invalidPayment(locale, "invalidInvoice");
}

function getIntentRecipient(intent) {
  return intent.beneficiary || intent.user;
}

function getPaymentParty(user) {
  if (!user) return null;

  const telegramName = [user.telegramFirstName, user.telegramLastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  return {
    id: user.id,
    telegramId: user.telegramId,
    languageCode: user.languageCode,
    displayName:
      user.name?.trim() ||
      telegramName ||
      (user.telegramUsername ? `@${user.telegramUsername}` : null),
    premiumExpiresAt: user.premiumExpiresAt,
  };
}

function paymentResult(intent, activated, newlyConfirmed, premiumExpiresAt) {
  const recipient = getPaymentParty(getIntentRecipient(intent));

  if (recipient && premiumExpiresAt !== undefined) {
    recipient.premiumExpiresAt = premiumExpiresAt;
  }

  return {
    activated,
    newlyConfirmed,
    isGift: Boolean(recipient && recipient.id !== intent.user.id),
    premiumExpiresAt: recipient?.premiumExpiresAt ?? null,
    recipientUserId: recipient?.id ?? null,
    transactionHash: intent.txHash ?? null,
    payer: getPaymentParty(intent.user),
    recipient,
  };
}

function failedPaymentResult() {
  return {
    activated: false,
    newlyConfirmed: false,
    isGift: false,
    premiumExpiresAt: null,
    recipientUserId: null,
    transactionHash: null,
    payer: null,
    recipient: null,
  };
}

async function activatePremiumForSuccessfulPayment(message, dependencies = {}) {
  const payment = message.successful_payment;
  if (!payment || !isPremiumPayload(payment.invoice_payload)) return failedPaymentResult();

  const database = dependencies.prisma || prisma;
  const intent = await findStarsIntent(payment.invoice_payload, database);
  const telegramUserId = message.from?.id ?? message.chat?.id;
  if (!intent || !telegramUserId) return failedPaymentResult();

  const chargeId = payment.telegram_payment_charge_id;
  const txHash = chargeId ? `telegram:${chargeId}` : null;
  if (
    !chargeId ||
    payment.currency !== "XTR" ||
    intent.provider !== "telegram_stars" ||
    intent.asset !== "XTR" ||
    intent.product !== "subscription" ||
    !["submitted", "confirmed"].includes(intent.status) ||
    (intent.status === "submitted" && !intent.providerSubmissionId) ||
    intent.user.telegramId !== BigInt(telegramUserId) ||
    Number(intent.amountNano.toFixed(0)) !== payment.total_amount ||
    (intent.status === "confirmed" && intent.txHash !== txHash)
  ) {
    console.warn("[favor-bot] Stars payment ignored because intent validation failed");
    return failedPaymentResult();
  }

  if (intent.status === "confirmed") {
    return paymentResult(intent, true, false);
  }

  let duration;

  try {
    duration = getIntentDuration(intent);
  } catch (error) {
    console.error("[favor-bot] Stars payment has an invalid subscription duration", {
      intentId: intent.id,
      error,
    });
    return failedPaymentResult();
  }

  const paidAt = new Date((message.date || Math.floor(Date.now() / 1000)) * 1000);

  for (let transactionAttempt = 0; transactionAttempt < 3; transactionAttempt += 1) {
    try {
      const outcome = await database.$transaction(async (tx) => {
        const fresh = await tx.paymentIntent.findUnique({
          where: { id: intent.id },
          include: {
            user: { select: PAYMENT_USER_SELECT },
            beneficiary: { select: PAYMENT_USER_SELECT },
          },
        });
        if (!fresh) return { activated: false, newlyConfirmed: false };
        if (fresh.status === "confirmed") {
          return {
            activated: fresh.txHash === txHash,
            newlyConfirmed: false,
            intent: fresh,
          };
        }
        if (
          fresh.status !== "submitted" ||
          !fresh.providerSubmissionId
        ) {
          return { activated: false, newlyConfirmed: false, intent: fresh };
        }

        const recipient = getIntentRecipient(fresh);
        const { startsAt, endsAt } = resolveSubscriptionPeriod({
          paymentAt: paidAt,
          currentExpiresAt: recipient.premiumExpiresAt,
          duration,
        });
        await tx.subscriptionPurchase.create({
          data: {
            paymentIntentId: fresh.id,
            userId: recipient.id,
            duration,
            startsAt,
            endsAt,
          },
        });
        await tx.user.update({
          where: { id: recipient.id },
          data: { isPremium: true, premiumExpiresAt: endsAt },
        });
        await tx.paymentIntent.update({
          where: { id: fresh.id },
          data: {
            status: "confirmed",
            txHash,
            txTimestamp: paidAt,
            confirmedAt: new Date(),
          },
        });
        fresh.status = "confirmed";
        fresh.txHash = txHash;
        recipient.premiumExpiresAt = endsAt;

        return {
          activated: true,
          newlyConfirmed: true,
          intent: fresh,
          premiumExpiresAt: endsAt,
        };
      }, { isolationLevel: "Serializable" });

      if (!outcome.activated || !outcome.intent) return failedPaymentResult();

      return paymentResult(
        outcome.intent,
        true,
        outcome.newlyConfirmed,
        outcome.premiumExpiresAt,
      );
    } catch (error) {
      if (error?.code === "P2002") {
        const duplicate = await database.paymentIntent.findFirst({
          where: { txHash },
          include: {
            user: { select: PAYMENT_USER_SELECT },
            beneficiary: { select: PAYMENT_USER_SELECT },
          },
        });
        return duplicate?.id === intent.id
          ? paymentResult(duplicate, true, false)
          : failedPaymentResult();
      }
      if (error?.code === "P2034" && transactionAttempt < 2) {
        continue;
      }
      throw error;
    }
  }
  return failedPaymentResult();
}

module.exports = {
  activatePremiumForSuccessfulPayment,
  validatePreCheckoutQuery,
};
