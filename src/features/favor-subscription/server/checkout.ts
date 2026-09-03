import {
  PaymentAsset,
  PaymentIntentStatus,
  PaymentProduct,
  PaymentProvider,
  Prisma,
  type PaymentIntent,
} from "@prisma/client";

import {
  YEARLY_SUBSCRIPTION_DURATION,
  type SubscriptionDuration,
} from "@/entities/subscription";
import { env } from "@/shared/config/env";
import { prepareFavorPaymentIntent } from "@/shared/lib/favor-payment/server";
import { ApplicationError } from "@/shared/lib/application-error";
import { getSubscriptionPriceUsdt } from "@/shared/lib/pricing";
import { prisma } from "@/shared/lib/prisma";
import {
  buildPremiumSubscriptionPayload,
  createTelegramStarsInvoiceLink,
  getPremiumSubscriptionMessages,
  getPremiumSubscriptionMonthlyPrice,
  getPremiumSubscriptionYearlyPrice,
} from "@/shared/lib/telegram/server";
import { buildTonSubscriptionReference, safeParseAddress } from "@/shared/lib/ton";
import {
  getGramPriceUsdt,
  getLiveFavorPriceInGram,
} from "@/shared/lib/ton/oracle";

import {
  favorCheckoutSchema,
  invoiceCheckoutSchema,
  parseSubscriptionIntentMetadata,
  tonCheckoutSchema,
  type SubscriptionIntentMetadata,
} from "./contracts";
import {
  assertExpectedSubscriptionQuote,
  buildFavorSubscriptionQuote,
  buildGramSubscriptionQuote,
} from "./quote";

const TELEGRAM_INVOICE_TTL_MS = 60 * 60 * 1000;
const ONCHAIN_QUOTE_TTL_MS = 10 * 60 * 1000;

type SubscriptionPayer = {
  id: number;
  walletAddress: string | null;
};

type IntentFingerprint = {
  payerId: number;
  beneficiaryUserId: number;
  idempotencyKey: string;
  provider: PaymentProvider;
  asset: PaymentAsset;
  duration: SubscriptionDuration;
  senderAddress?: string;
  expectedAmountNano?: string;
};

const checkoutConflict = () => new ApplicationError(
  "SUBSCRIPTION_CHECKOUT_ATTEMPT_CONFLICT",
  "The checkout attempt was already used with different parameters.",
  409,
);

const resolveSubscriptionBeneficiary = async ({
  payerId,
  recipientUserId,
}: {
  payerId: number;
  recipientUserId?: number;
}) => {
  const beneficiaryUserId = recipientUserId ?? payerId;
  const beneficiary = await prisma.user.findUnique({
    where: { id: beneficiaryUserId },
    select: { id: true, isPremium: true, premiumExpiresAt: true },
  });

  if (!beneficiary) {
    throw new ApplicationError(
      "SUBSCRIPTION_RECIPIENT_NOT_FOUND",
      "The subscription recipient was not found.",
      404,
    );
  }

  const recipientSubscriptionActive = beneficiary.premiumExpiresAt
    ? beneficiary.premiumExpiresAt > new Date()
    : beneficiary.isPremium;

  return {
    id: beneficiary.id,
    isGift: beneficiary.id !== payerId,
    recipientSubscriptionActive,
  };
};

const findIntentByAttempt = (payerId: number, idempotencyKey: string) =>
  prisma.paymentIntent.findUnique({
    where: { userId_idempotencyKey: { userId: payerId, idempotencyKey } },
  });

const sameWallet = (left?: string | null, right?: string) => {
  if (right === undefined) return true;
  if (!left) return false;

  try {
    return safeParseAddress(left).equals(safeParseAddress(right));
  } catch {
    return false;
  }
};

const resolveCanonicalPayerAddress = (
  accountWalletAddress: string | null,
  requestedWalletAddress: string,
) => {
  if (!accountWalletAddress) throw new Error("WALLET_DOES_NOT_MATCH_ACCOUNT");

  const accountAddress = safeParseAddress(accountWalletAddress);
  const requestedAddress = safeParseAddress(requestedWalletAddress);
  if (!accountAddress.equals(requestedAddress)) {
    throw new Error("WALLET_DOES_NOT_MATCH_ACCOUNT");
  }

  return requestedAddress.toString();
};

const assertIntentFingerprint = (
  intent: PaymentIntent,
  expected: IntentFingerprint,
) => {
  let metadata: SubscriptionIntentMetadata;

  try {
    metadata = parseSubscriptionIntentMetadata(intent.metadata);
  } catch {
    throw checkoutConflict();
  }

  if (
    intent.userId !== expected.payerId ||
    intent.beneficiaryUserId !== expected.beneficiaryUserId ||
    intent.idempotencyKey !== expected.idempotencyKey ||
    intent.product !== PaymentProduct.subscription ||
    intent.provider !== expected.provider ||
    intent.asset !== expected.asset ||
    metadata.duration !== expected.duration ||
    (expected.expectedAmountNano !== undefined &&
      intent.amountNano.toFixed(0) !== expected.expectedAmountNano) ||
    !sameWallet(intent.senderAddress, expected.senderAddress)
  ) {
    throw checkoutConflict();
  }

  return metadata;
};

const assertIntentCanBePrepared = (intent: PaymentIntent) => {
  if (intent.status === PaymentIntentStatus.confirmed) return;

  if (intent.status === PaymentIntentStatus.failed) {
    throw new ApplicationError(
      "SUBSCRIPTION_CHECKOUT_ATTEMPT_FAILED",
      "The checkout attempt has failed. Start a new checkout attempt.",
      409,
    );
  }

  if (
    intent.status === PaymentIntentStatus.expired ||
    intent.expiresAt <= new Date()
  ) {
    throw new ApplicationError(
      "SUBSCRIPTION_CHECKOUT_ATTEMPT_EXPIRED",
      "The checkout attempt has expired. Start a new checkout attempt.",
      409,
    );
  }
};

const recoverIdempotentCreate = async ({
  error,
  fingerprint,
}: {
  error: unknown;
  fingerprint: IntentFingerprint;
}) => {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    throw error;
  }

  const racedIntent = await findIntentByAttempt(
    fingerprint.payerId,
    fingerprint.idempotencyKey,
  );

  if (!racedIntent) throw error;
  assertIntentFingerprint(racedIntent, fingerprint);
  return racedIntent;
};

const loadExistingIntent = async (fingerprint: IntentFingerprint) => {
  const intent = await findIntentByAttempt(
    fingerprint.payerId,
    fingerprint.idempotencyKey,
  );

  if (!intent) return null;
  assertIntentFingerprint(intent, fingerprint);
  return intent;
};

const toPreparationContext = (
  intent: PaymentIntent,
  recipientSubscriptionActive: boolean,
) => ({
  recipientSubscriptionActive,
  paymentIntentId: intent.id,
  recipientUserId: intent.beneficiaryUserId!,
  isGift: intent.userId !== intent.beneficiaryUserId,
  status: intent.status,
  expiresAt: intent.expiresAt,
});

export async function prepareTelegramSubscriptionInvoice({
  payer,
  input,
}: {
  payer: SubscriptionPayer;
  input: unknown;
}) {
  const parsed = invoiceCheckoutSchema.parse(input);
  const beneficiary = await resolveSubscriptionBeneficiary({
    payerId: payer.id,
    recipientUserId: parsed.recipientUserId,
  });
  const fingerprint: IntentFingerprint = {
    payerId: payer.id,
    beneficiaryUserId: beneficiary.id,
    idempotencyKey: parsed.checkoutAttemptId,
    provider: PaymentProvider.telegram_stars,
    asset: PaymentAsset.XTR,
    duration: parsed.duration,
  };
  let intent = await loadExistingIntent(fingerprint);

  if (!intent) {
    const price = parsed.duration === YEARLY_SUBSCRIPTION_DURATION
      ? getPremiumSubscriptionYearlyPrice(parsed.locale)
      : getPremiumSubscriptionMonthlyPrice(parsed.locale);

    try {
      intent = await prisma.paymentIntent.create({
        data: {
          userId: payer.id,
          beneficiaryUserId: beneficiary.id,
          idempotencyKey: parsed.checkoutAttemptId,
          provider: PaymentProvider.telegram_stars,
          asset: PaymentAsset.XTR,
          product: PaymentProduct.subscription,
          amountNano: new Prisma.Decimal(price.amount),
          quotedPriceUsdt: new Prisma.Decimal(
            getSubscriptionPriceUsdt(parsed.duration).toFixed(8),
          ),
          reference: buildPremiumSubscriptionPayload(payer.id, parsed.duration),
          expiresAt: new Date(Date.now() + TELEGRAM_INVOICE_TTL_MS),
          metadata: { duration: parsed.duration },
        },
      });
    } catch (error) {
      intent = await recoverIdempotentCreate({ error, fingerprint });
    }
  }

  assertIntentCanBePrepared(intent);

  if (intent.status === PaymentIntentStatus.confirmed) {
    const metadata = parseSubscriptionIntentMetadata(intent.metadata);
    return {
      ...toPreparationContext(intent, beneficiary.recipientSubscriptionActive),
      invoiceLink: metadata.invoiceLink ?? null,
    };
  }

  const metadata = parseSubscriptionIntentMetadata(intent.metadata);
  if (metadata.invoiceLink) {
    return {
      ...toPreparationContext(intent, beneficiary.recipientSubscriptionActive),
      invoiceLink: metadata.invoiceLink,
    };
  }

  const messages = getPremiumSubscriptionMessages(parsed.locale);
  const price = parsed.duration === YEARLY_SUBSCRIPTION_DURATION
    ? getPremiumSubscriptionYearlyPrice(parsed.locale)
    : getPremiumSubscriptionMonthlyPrice(parsed.locale);

  // Concurrent prepares may create more than one Telegram link for this immutable
  // payload. The bot atomically claims providerSubmissionId, so only one distinct
  // pre-checkout query (and therefore at most one Stars charge) can be accepted.
  try {
    const invoiceLink = await createTelegramStarsInvoiceLink({
      title: "Favor Plus",
      description:
        parsed.duration === YEARLY_SUBSCRIPTION_DURATION
          ? messages.yearlyDescription
          : messages.monthlyDescription,
      payload: intent.reference,
      prices: [price],
    });
    intent = await prisma.paymentIntent.update({
      where: { id: intent.id },
      data: {
        failureReason: null,
        metadata: { duration: parsed.duration, invoiceLink },
      },
    });
    return {
      ...toPreparationContext(intent, beneficiary.recipientSubscriptionActive),
      invoiceLink,
    };
  } catch (error) {
    await prisma.paymentIntent.updateMany({
      where: {
        id: intent.id,
        status: { not: PaymentIntentStatus.confirmed },
      },
      data: {
        failureReason: "TELEGRAM_INVOICE_CREATION_FAILED",
      },
    });
    throw error;
  }
}

export async function prepareTonSubscriptionPayment({
  payer,
  input,
}: {
  payer: SubscriptionPayer;
  input: unknown;
}) {
  const parsed = tonCheckoutSchema.parse(input);
  const senderAddress = resolveCanonicalPayerAddress(
    payer.walletAddress,
    parsed.userWalletAddress,
  );

  const beneficiary = await resolveSubscriptionBeneficiary({
    payerId: payer.id,
    recipientUserId: parsed.recipientUserId,
  });
  const fingerprint: IntentFingerprint = {
    payerId: payer.id,
    beneficiaryUserId: beneficiary.id,
    idempotencyKey: parsed.checkoutAttemptId,
    provider: PaymentProvider.ton_chain,
    asset: PaymentAsset.GRAM,
    duration: parsed.duration,
    senderAddress,
    expectedAmountNano: parsed.expectedAmountNano,
  };
  let intent = await loadExistingIntent(fingerprint);

  if (!intent) {
    const quote = buildGramSubscriptionQuote({
      duration: parsed.duration,
      gramPriceUsdt: await getGramPriceUsdt(),
    });
    assertExpectedSubscriptionQuote({
      asset: "GRAM",
      expectedAmountNano: parsed.expectedAmountNano,
      actualAmountNano: quote.amountNano,
    });

    try {
      intent = await prisma.paymentIntent.create({
        data: {
          userId: payer.id,
          beneficiaryUserId: beneficiary.id,
          idempotencyKey: parsed.checkoutAttemptId,
          provider: PaymentProvider.ton_chain,
          asset: PaymentAsset.GRAM,
          product: PaymentProduct.subscription,
          amountNano: new Prisma.Decimal(quote.amountNano.toString()),
          quotedPriceUsdt: new Prisma.Decimal(
            getSubscriptionPriceUsdt(parsed.duration).toFixed(8),
          ),
          senderAddress,
          recipientAddress: env.requireTonRecipientWallet(),
          reference: buildTonSubscriptionReference(payer.id, parsed.duration),
          expiresAt: new Date(Date.now() + ONCHAIN_QUOTE_TTL_MS),
          metadata: { duration: parsed.duration },
        },
      });
    } catch (error) {
      intent = await recoverIdempotentCreate({ error, fingerprint });
    }
  }

  assertIntentCanBePrepared(intent);

  return {
    ...toPreparationContext(intent, beneficiary.recipientSubscriptionActive),
    recipientAddress: intent.recipientAddress,
    amountNano: intent.amountNano.toFixed(0),
    reference: intent.reference,
    serverTime: Math.floor(Date.now() / 1000),
  };
}

export async function prepareFavorSubscriptionPayment({
  payer,
  input,
}: {
  payer: SubscriptionPayer;
  input: unknown;
}) {
  const parsed = favorCheckoutSchema.parse(input);
  const senderAddress = resolveCanonicalPayerAddress(
    payer.walletAddress,
    parsed.userWalletAddress,
  );

  const beneficiary = await resolveSubscriptionBeneficiary({
    payerId: payer.id,
    recipientUserId: parsed.recipientUserId,
  });
  const fingerprint: IntentFingerprint = {
    payerId: payer.id,
    beneficiaryUserId: beneficiary.id,
    idempotencyKey: parsed.checkoutAttemptId,
    provider: PaymentProvider.ton_chain,
    asset: PaymentAsset.FAVOR,
    duration: parsed.duration,
    senderAddress,
    expectedAmountNano: parsed.expectedAmountNano,
  };
  let intent = await loadExistingIntent(fingerprint);

  if (!intent) {
    const [favorPriceInGram, gramPriceUsdt] = await Promise.all([
      getLiveFavorPriceInGram(),
      getGramPriceUsdt(),
    ]);
    if (favorPriceInGram === null) {
      throw new ApplicationError(
        "FAVOR_QUOTE_UNAVAILABLE",
        "A live FAVOR quote is temporarily unavailable.",
        503,
      );
    }
    const quote = buildFavorSubscriptionQuote({
      favorPriceInGram,
      gramPriceUsdt,
    });
    assertExpectedSubscriptionQuote({
      asset: "FAVOR",
      expectedAmountNano: parsed.expectedAmountNano,
      actualAmountNano: quote.amountNano,
    });

    try {
      intent = await prepareFavorPaymentIntent({
        userId: payer.id,
        beneficiaryUserId: beneficiary.id,
        idempotencyKey: parsed.checkoutAttemptId,
        userWalletAddress: senderAddress,
        amountNano: quote.amountNano,
        quotedPriceUsdt: quote.priceUsdt,
        product: PaymentProduct.subscription,
        expiresAt: new Date(Date.now() + ONCHAIN_QUOTE_TTL_MS),
        metadata: { duration: parsed.duration },
      });
    } catch (error) {
      intent = await recoverIdempotentCreate({ error, fingerprint });
    }
  }

  assertIntentCanBePrepared(intent);
  if (!intent.quotedPriceUsdt || intent.amountNano.lte(0)) {
    throw new Error("INVALID_FAVOR_SUBSCRIPTION_QUOTE");
  }
  const favorPriceUsdt = intent.quotedPriceUsdt
    .mul(1_000_000_000)
    .div(intent.amountNano)
    .toNumber();

  return {
    ...toPreparationContext(intent, beneficiary.recipientSubscriptionActive),
    recipientAddress: intent.recipientAddress,
    userJettonWalletAddress: intent.senderJettonWalletAddress,
    amountNano: intent.amountNano.toFixed(0),
    reference: intent.reference,
    favorPriceUsdt,
    serverTime: Math.floor(Date.now() / 1000),
  };
}
