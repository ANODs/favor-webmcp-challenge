import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";

const require = createRequire(import.meta.url);
process.env.TELEGRAM_BOT_TOKEN ||= "contract-test-token";

const {
  activatePremiumForSuccessfulPayment,
  validatePreCheckoutQuery,
} = require("../../bot/src/features/handle-payment") as {
  activatePremiumForSuccessfulPayment: (
    message: Record<string, unknown>,
    dependencies: { prisma: Record<string, unknown> },
  ) => Promise<Record<string, unknown>>;
  validatePreCheckoutQuery: (
    query: Record<string, unknown>,
    locale: string,
    dependencies: { prisma: Record<string, unknown>; now: () => Date },
  ) => Promise<{ ok: boolean; errorMessage?: string }>;
};
const {
  processTelegramUpdate,
  sendSuccessfulPaymentMessages,
  shouldDeferUpdateCompletion,
} = require("../../bot/src/app/start-bot") as {
  processTelegramUpdate: (
    update: Record<string, unknown>,
    dependencies: Record<string, unknown>,
  ) => Promise<{ handled: boolean; duplicate: boolean }>;
  sendSuccessfulPaymentMessages: (
    message: Record<string, unknown>,
    locale: string,
    result: Record<string, unknown>,
    dependencies: Record<string, unknown>,
  ) => Promise<void>;
  shouldDeferUpdateCompletion: (update: Record<string, unknown>) => boolean;
};
const {
  buildSubscriptionGiftNotification,
  notifySubscriptionGiftRecipient,
} = require("../../bot/src/features/notify-subscription-gift") as {
  buildSubscriptionGiftNotification: (input: {
    locale: string | null;
    payerName: string | null;
    premiumExpiresAt: Date | null;
    settingsUrl: string;
  }) => {
    html: string;
    fallbackHtml: string;
    text: string;
    benefits: Array<{ id: string; label: string }>;
    buttons: Array<{ text: string; url: string }>;
  };
  notifySubscriptionGiftRecipient: (
    result: Record<string, unknown>,
    dependencies: Record<string, unknown>,
  ) => Promise<{
    sent: boolean;
    transport?: "rich_video" | "rich";
    reason?: "not_new_gift" | "delivery_failed";
  }>;
};
const {
  TelegramApiError,
  isExpiredPreCheckoutQueryError,
} = require("../../bot/src/shared/lib/telegram-api-error") as {
  TelegramApiError: new (
    method: string,
    errorCode: number,
    description: string,
  ) => Error;
  isExpiredPreCheckoutQueryError: (error: unknown) => boolean;
};
const {
  FAVOR_SUBSCRIPTION_DURATION,
  MONTHLY_SUBSCRIPTION_DURATION,
  SUBSCRIPTION_DURATIONS,
  YEARLY_SUBSCRIPTION_DURATION,
  addSubscriptionPeriod,
  parseSubscriptionDuration,
  resolveSubscriptionPeriod,
} = require("../../src/shared/lib/subscription/runtime.cjs") as typeof import(
  "../../src/shared/lib/subscription/runtime.cjs"
);

type PaymentParty = {
  id: number;
  telegramId: bigint;
  telegramUsername: string | null;
  telegramFirstName: string | null;
  telegramLastName: string | null;
  languageCode: string | null;
  name: string | null;
  premiumExpiresAt: Date | null;
};

type PaymentIntentFixture = {
  id: string;
  reference: string;
  provider: string;
  asset: string;
  product: string;
  status: string;
  amountNano: { toFixed: () => string };
  expiresAt: Date;
  metadata: { duration: string };
  txHash: string | null;
  providerSubmissionId: string | null;
  submittedAt: Date | null;
  user: PaymentParty;
  beneficiary: PaymentParty | null;
};

function createParty(
  id: number,
  telegramId: bigint,
  overrides: Partial<PaymentParty> = {},
): PaymentParty {
  return {
    id,
    telegramId,
    telegramUsername: null,
    telegramFirstName: null,
    telegramLastName: null,
    languageCode: "ru",
    name: null,
    premiumExpiresAt: null,
    ...overrides,
  };
}

function createIntent(
  overrides: Partial<PaymentIntentFixture> = {},
): PaymentIntentFixture {
  const status = overrides.status ?? "submitted";

  return {
    id: "intent-gift-1",
    reference: "favor-premium:intent-gift-1",
    provider: "telegram_stars",
    asset: "XTR",
    product: "subscription",
    status,
    amountNano: { toFixed: () => "199" },
    expiresAt: new Date("2026-09-02T00:00:00.000Z"),
    metadata: { duration: "1m" },
    txHash: null,
    providerSubmissionId:
      status === "submitted" ? "pre-checkout-default" : null,
    submittedAt: null,
    user: createParty(10, 111n, { name: "Payer" }),
    beneficiary: createParty(20, 222n, {
      languageCode: "en",
      name: "Recipient",
      premiumExpiresAt: new Date("2026-10-01T00:00:00.000Z"),
    }),
    ...overrides,
  };
}

function createSuccessfulPaymentMessage() {
  return {
    date: Math.floor(new Date("2026-09-01T00:00:00.000Z").getTime() / 1000),
    from: { id: 111 },
    chat: { id: 111 },
    successful_payment: {
      currency: "XTR",
      total_amount: 199,
      invoice_payload: "favor-premium:intent-gift-1",
      telegram_payment_charge_id: "charge-1",
    },
  };
}

function createPaymentPrisma(
  intent: PaymentIntentFixture,
  options: {
    transactionError?: { code: string };
    duplicateIntent?: PaymentIntentFixture | null;
  } = {},
) {
  const writes = {
    purchases: [] as Array<Record<string, unknown>>,
    userUpdates: [] as Array<Record<string, unknown>>,
    intentUpdates: [] as Array<Record<string, unknown>>,
    transactionCalls: 0,
  };

  const paymentIntent = {
    findUnique: async ({ where }: { where: { id?: string; reference?: string } }) =>
      where.id === intent.id || where.reference === intent.reference ? intent : null,
    findFirst: async () => options.duplicateIntent ?? null,
    update: async ({ data }: { data: Record<string, unknown> }) => {
      writes.intentUpdates.push(data);
      Object.assign(intent, data);
      return intent;
    },
    updateMany: async ({
      where,
      data,
    }: {
      where: {
        id: string;
        status: string;
        providerSubmissionId: null;
      };
      data: Record<string, unknown>;
    }) => {
      if (
        where.id !== intent.id ||
        intent.status !== where.status ||
        intent.providerSubmissionId !== where.providerSubmissionId
      ) {
        return { count: 0 };
      }
      writes.intentUpdates.push(data);
      Object.assign(intent, data);
      return { count: 1 };
    },
  };
  const prisma = {
    paymentIntent,
    $transaction: async (callback: (tx: Record<string, unknown>) => Promise<unknown>) => {
      writes.transactionCalls += 1;
      if (options.transactionError) throw options.transactionError;

      return callback({
        paymentIntent,
        subscriptionPurchase: {
          create: async ({ data }: { data: Record<string, unknown> }) => {
            writes.purchases.push(data);
            return data;
          },
        },
        user: {
          update: async (args: Record<string, unknown>) => {
            writes.userUpdates.push(args);
            return args;
          },
        },
      });
    },
  };

  return { prisma, writes };
}

test("Stars pre-checkout authenticates the payer, not the gift recipient", async () => {
  const intent = createIntent({ status: "created" });
  const { prisma } = createPaymentPrisma(intent);
  const query = {
    id: "pre-checkout-1",
    currency: "XTR",
    total_amount: 199,
    invoice_payload: intent.reference,
    from: { id: 111 },
  };

  assert.deepEqual(
    await validatePreCheckoutQuery(query, "en", {
      prisma,
      now: () => new Date("2026-09-01T00:00:00.000Z"),
    }),
    { ok: true },
  );

  const recipientAsPayer = await validatePreCheckoutQuery(
    { ...query, from: { id: 222 } },
    "en",
    {
      prisma,
      now: () => new Date("2026-09-01T00:00:00.000Z"),
    },
  );
  assert.equal(recipientAsPayer.ok, false);
});

test("Stars pre-checkout accepts one distinct claim and idempotently retries the same query", async () => {
  const intent = createIntent({ status: "created" });
  const { prisma } = createPaymentPrisma(intent);
  const query = {
    id: "pre-checkout-race-1",
    currency: "XTR",
    total_amount: 199,
    invoice_payload: intent.reference,
    from: { id: 111 },
  };
  const dependencies = {
    prisma,
    now: () => new Date("2026-09-01T00:00:00.000Z"),
  };

  const results = await Promise.all([
    validatePreCheckoutQuery(query, "en", dependencies),
    validatePreCheckoutQuery({ ...query, id: "pre-checkout-race-2" }, "en", dependencies),
  ]);

  assert.equal(results.filter((result) => result.ok).length, 1);
  assert.equal(intent.status, "submitted");
  assert.match(intent.providerSubmissionId ?? "", /^pre-checkout-race-/);
  assert.equal(
    (await validatePreCheckoutQuery(
      { ...query, id: intent.providerSubmissionId },
      "en",
      dependencies,
    )).ok,
    true,
  );
  assert.equal(
    (await validatePreCheckoutQuery(
      { ...query, id: "pre-checkout-repeat" },
      "en",
      dependencies,
    )).ok,
    false,
  );
});

test("transient Stars pre-checkout claim failures retry before dedup registration", async () => {
  const intent = createIntent({ status: "created" });
  const { prisma } = createPaymentPrisma(intent);
  const paymentIntent = prisma.paymentIntent as unknown as {
    updateMany: (args: Record<string, unknown>) => Promise<{ count: number }>;
  };
  const updateMany = paymentIntent.updateMany.bind(paymentIntent);
  let claimAttempts = 0;
  paymentIntent.updateMany = async (args) => {
    claimAttempts += 1;
    if (claimAttempts === 1) throw new Error("transient pre-checkout database failure");
    return updateMany(args);
  };

  const processed = new Set<number>();
  let registrations = 0;
  const update = {
    update_id: 9000,
    pre_checkout_query: {
      id: "pre-checkout-transient",
      currency: "XTR",
      total_amount: 199,
      invoice_payload: intent.reference,
      from: { id: 111 },
    },
  };
  const dependencies = {
    isTelegramUpdateProcessed: async (updateId: number) => processed.has(updateId),
    registerTelegramUpdate: async (updateId: number) => {
      registrations += 1;
      if (processed.has(updateId)) return false;
      processed.add(updateId);
      return true;
    },
    handlePreCheckoutQuery: (query: Record<string, unknown>) =>
      validatePreCheckoutQuery(query, "en", {
        prisma,
        now: () => new Date("2026-09-01T00:00:00.000Z"),
      }),
  };

  assert.equal(shouldDeferUpdateCompletion(update), true);
  await assert.rejects(
    processTelegramUpdate(update, dependencies),
    /transient pre-checkout database failure/,
  );
  assert.equal(processed.has(9000), false);
  assert.equal(registrations, 0);
  assert.equal(intent.status, "created");

  assert.deepEqual(await processTelegramUpdate(update, dependencies), {
    handled: true,
    duplicate: false,
  });
  assert.equal(processed.has(9000), true);
  assert.equal(registrations, 1);
  assert.equal(intent.providerSubmissionId, "pre-checkout-transient");
});

test("expired Telegram pre-checkout answers are terminal only for that method", () => {
  assert.equal(
    isExpiredPreCheckoutQueryError(
      new TelegramApiError(
        "answerPreCheckoutQuery",
        400,
        "Bad Request: query is too old and response timeout expired",
      ),
    ),
    true,
  );
  assert.equal(
    isExpiredPreCheckoutQueryError(
      new TelegramApiError(
        "answerInlineQuery",
        400,
        "Bad Request: query is too old and response timeout expired",
      ),
    ),
    false,
  );
  assert.equal(
    isExpiredPreCheckoutQueryError(
      new TelegramApiError(
        "answerPreCheckoutQuery",
        500,
        "Internal Server Error",
      ),
    ),
    false,
  );
});

test("Stars fulfillment extends and records the beneficiary subscription once", async () => {
  const intent = createIntent();
  const { prisma, writes } = createPaymentPrisma(intent);
  const message = createSuccessfulPaymentMessage();

  const result = await activatePremiumForSuccessfulPayment(message, { prisma });

  assert.equal(result.activated, true);
  assert.equal(result.newlyConfirmed, true);
  assert.equal(result.isGift, true);
  assert.equal(result.recipientUserId, 20);
  assert.equal(result.transactionHash, "telegram:charge-1");
  assert.equal(
    (result.premiumExpiresAt as Date).toISOString(),
    "2026-11-01T00:00:00.000Z",
  );
  assert.equal(writes.purchases.length, 1);
  assert.equal(writes.purchases[0].userId, 20);
  assert.equal((writes.purchases[0].startsAt as Date).toISOString(), "2026-10-01T00:00:00.000Z");
  assert.equal((writes.purchases[0].endsAt as Date).toISOString(), "2026-11-01T00:00:00.000Z");
  assert.deepEqual(writes.userUpdates[0].where, { id: 20 });

  const duplicate = await activatePremiumForSuccessfulPayment(message, { prisma });
  assert.equal(duplicate.activated, true);
  assert.equal(duplicate.newlyConfirmed, false);
  assert.equal(writes.purchases.length, 1);
});

test("Stars fulfillment requires an accepted pre-checkout claim", async () => {
  for (const intent of [
    createIntent({ status: "created" }),
    createIntent({ status: "submitted", providerSubmissionId: null }),
  ]) {
    const { prisma, writes } = createPaymentPrisma(intent);

    const result = await activatePremiumForSuccessfulPayment(
      createSuccessfulPaymentMessage(),
      { prisma },
    );

    assert.equal(result.activated, false);
    assert.equal(writes.transactionCalls, 0);
    assert.equal(writes.purchases.length, 0);
  }
});

test("legacy and self-payment intents fulfill the payer subscription", async () => {
  const intent = createIntent({
    beneficiary: null,
    metadata: { duration: "1y" },
  });
  const { prisma, writes } = createPaymentPrisma(intent);

  const result = await activatePremiumForSuccessfulPayment(
    createSuccessfulPaymentMessage(),
    { prisma },
  );

  assert.equal(result.activated, true);
  assert.equal(result.newlyConfirmed, true);
  assert.equal(result.isGift, false);
  assert.equal(result.recipientUserId, 10);
  assert.equal(writes.purchases[0].userId, 10);
  assert.deepEqual(writes.userUpdates[0].where, { id: 10 });
});

test("Stars fulfillment fails closed for unknown subscription durations", async () => {
  const intent = createIntent({ metadata: { duration: "forever" } });
  const { prisma, writes } = createPaymentPrisma(intent);

  const preCheckout = await validatePreCheckoutQuery(
    {
      currency: "XTR",
      total_amount: 199,
      invoice_payload: intent.reference,
      from: { id: 111 },
    },
    "en",
    {
      prisma,
      now: () => new Date("2026-09-01T00:00:00.000Z"),
    },
  );

  const result = await activatePremiumForSuccessfulPayment(
    createSuccessfulPaymentMessage(),
    { prisma },
  );

  assert.equal(preCheckout.ok, false);
  assert.equal(result.activated, false);
  assert.equal(writes.transactionCalls, 0);
  assert.throws(() => parseSubscriptionDuration("forever"), {
    message: "INVALID_SUBSCRIPTION_DURATION",
  });
});

test("a duplicate provider charge resolves to the already-confirmed same intent", async () => {
  const intent = createIntent();
  const duplicateIntent = createIntent({
    status: "confirmed",
    txHash: "telegram:charge-1",
  });
  const { prisma } = createPaymentPrisma(intent, {
    transactionError: { code: "P2002" },
    duplicateIntent,
  });

  const result = await activatePremiumForSuccessfulPayment(
    createSuccessfulPaymentMessage(),
    { prisma },
  );

  assert.equal(result.activated, true);
  assert.equal(result.newlyConfirmed, false);
  assert.equal(result.recipientUserId, 20);
});

test("successful_payment update is retried until handler and dedup registration succeed", async () => {
  const processed = new Set<number>();
  let handlerCalls = 0;
  let registrationCalls = 0;
  const update = {
    update_id: 9001,
    message: { successful_payment: { invoice_payload: "favor-premium:intent-gift-1" } },
  };
  const dependencies = {
    isTelegramUpdateProcessed: async (updateId: number) => processed.has(updateId),
    registerTelegramUpdate: async (updateId: number) => {
      registrationCalls += 1;
      if (processed.has(updateId)) return false;
      processed.add(updateId);
      return true;
    },
    handleMessage: async () => {
      handlerCalls += 1;
      if (handlerCalls === 1) throw new Error("transient fulfillment failure");
    },
  };

  await assert.rejects(
    processTelegramUpdate(update, dependencies),
    /transient fulfillment failure/,
  );
  assert.equal(processed.has(9001), false);
  assert.equal(registrationCalls, 0);

  assert.deepEqual(await processTelegramUpdate(update, dependencies), {
    handled: true,
    duplicate: false,
  });
  assert.equal(processed.has(9001), true);
  assert.equal(registrationCalls, 1);

  assert.deepEqual(await processTelegramUpdate(update, dependencies), {
    handled: false,
    duplicate: true,
  });
  assert.equal(handlerCalls, 2);
  assert.equal(registrationCalls, 1);
});

test("transient Stars fulfillment errors do not mark the Telegram update processed", async () => {
  const intent = createIntent();
  const transientError = Object.assign(new Error("database unavailable"), {
    code: "P1001",
  });
  const { prisma } = createPaymentPrisma(intent, {
    transactionError: transientError,
  });
  let registrationCalls = 0;

  await assert.rejects(
    processTelegramUpdate(
      {
        update_id: 9002,
        message: createSuccessfulPaymentMessage(),
      },
      {
        isTelegramUpdateProcessed: async () => false,
        registerTelegramUpdate: async () => {
          registrationCalls += 1;
          return true;
        },
        handleMessage: (message: Record<string, unknown>) =>
          activatePremiumForSuccessfulPayment(message, { prisma }),
      },
    ),
    /database unavailable/,
  );
  assert.equal(registrationCalls, 0);
});

test("non-payment updates retain register-before-processing deduplication", async () => {
  const processed = new Set<number>();
  let handlerCalls = 0;
  const update = { update_id: 42, message: { text: "/help" } };
  const dependencies = {
    isTelegramUpdateProcessed: async () => false,
    registerTelegramUpdate: async (updateId: number) => {
      if (processed.has(updateId)) return false;
      processed.add(updateId);
      return true;
    },
    handleMessage: async () => {
      handlerCalls += 1;
      throw new Error("message handler failed");
    },
  };

  await assert.rejects(processTelegramUpdate(update, dependencies), /message handler failed/);
  assert.equal(processed.has(42), true);
  assert.deepEqual(await processTelegramUpdate(update, dependencies), {
    handled: false,
    duplicate: true,
  });
  assert.equal(handlerCalls, 1);
});

test("gift notification renders a video-first rich message with every Plus benefit", () => {
  const notification = buildSubscriptionGiftNotification({
    locale: "en-US",
    payerName: "  Payer\nName  ",
    premiumExpiresAt: new Date("2027-08-27T12:00:00.000Z"),
    settingsUrl: "https://t.me/FavorDealsBot?startapp=settings",
  });

  assert.ok(
    notification.html.startsWith(
      '<video src="tg://video?id=favor_plus_gift_video"></video>',
    ),
  );
  assert.doesNotMatch(notification.fallbackHtml, /<video/);
  assert.match(notification.html, /From: Payer Name/);
  assert.match(notification.html, /27 August 2027/);
  assert.deepEqual(
    notification.benefits.map(({ id }) => id),
    [
      "active_contracts",
      "scout_contracts",
      "contact_views",
      "feed_priority",
      "og_previews",
    ],
  );
  for (const benefit of [
    "Up to 5 active contracts",
    "Up to 50 scout contracts",
    "Unlimited contact views",
    "Priority in the feed and search",
    "Social OG previews",
  ]) {
    assert.match(notification.html, new RegExp(benefit));
  }
  assert.ok(
    notification.html.indexOf("<video") < notification.html.indexOf("<h1>"),
  );
  assert.ok(
    notification.html.indexOf("<h2>") <
      notification.html.indexOf("<tg-button-row"),
  );
  assert.ok(notification.html.endsWith("</tg-button-row>"));

  const russian = buildSubscriptionGiftNotification({
    locale: "ru",
    payerName: null,
    premiumExpiresAt: new Date("2027-08-27T12:00:00.000Z"),
    settingsUrl: "https://t.me/FavorDealsBot?startapp=settings",
  });
  assert.match(russian.html, /Отправитель: Пользователь Favor/);
  assert.match(russian.html, /До 5 активных контрактов/);
  assert.match(russian.html, /До 50 скаут-контрактов/);
  assert.match(russian.html, /Безлимитный просмотр контактов/);
  assert.match(russian.html, /Приоритет в ленте и поиске/);
  assert.match(russian.html, /Генерация OG-превью/);
  assert.match(
    russian.html,
    /<tg-button type="url" style="success" url="https:\/\/t\.me\/FavorDealsBot\?startapp=settings">Открыть Favor ✨<\/tg-button>/,
  );
});

test("gift recipient rich video is sent only for a new confirmation", async () => {
  const textAttempts: Array<{
    chatId: string | number;
    text: string;
    buttons: Array<{ text: string; url: string }>;
  }> = [];
  const richVideoAttempts: Array<{
    chatId: string | number;
    html: string;
    videoPath: string;
    media: Record<string, unknown>;
  }> = [];
  const errors: unknown[] = [];
  const result = {
    activated: true,
    newlyConfirmed: true,
    isGift: true,
    premiumExpiresAt: new Date("2027-08-27T12:00:00.000Z"),
    payer: { displayName: "Payer" },
    recipient: {
      id: 20,
      telegramId: 222n,
      languageCode: "en",
      displayName: "Recipient",
    },
  };
  const dependencies = {
    botUsername: "FavorDealsBot",
    videoPath: "C:\\gift-media\\favor-plus-gift.mp4",
    sendRichVideoMessage: async (
      chatId: string | number,
      html: string,
      videoPath: string,
      media: Record<string, unknown>,
    ) => {
      richVideoAttempts.push({ chatId, html, videoPath, media });
      return { message_id: 123 };
    },
    sendTextMessage: async (
      chatId: string | number,
      text: string,
      buttons: Array<{ text: string; url: string }> = [],
    ) => {
      textAttempts.push({ chatId, text, buttons });
    },
    logError: (...args: unknown[]) => errors.push(args),
  };

  await sendSuccessfulPaymentMessages(
    { chat: { id: 111 } },
    "ru",
    result,
    dependencies,
  );
  assert.equal(richVideoAttempts.length, 1);
  assert.equal(richVideoAttempts[0].chatId, "222");
  assert.equal(
    richVideoAttempts[0].videoPath,
    "C:\\gift-media\\favor-plus-gift.mp4",
  );
  assert.ok(richVideoAttempts[0].html.startsWith("<video"));
  assert.match(richVideoAttempts[0].html, /From: Payer/);
  assert.equal(richVideoAttempts[0].media.mediaId, "favor_plus_gift_video");
  assert.deepEqual(textAttempts.map(({ chatId }) => chatId), [111]);
  assert.match(textAttempts[0].text, /Recipient/);
  assert.equal(errors.length, 0);

  richVideoAttempts.length = 0;
  textAttempts.length = 0;
  await sendSuccessfulPaymentMessages(
    { chat: { id: 111 } },
    "ru",
    { ...result, newlyConfirmed: false },
    dependencies,
  );
  assert.equal(richVideoAttempts.length, 0);
  assert.deepEqual(textAttempts.map(({ chatId }) => chatId), [111]);
});

test("gift recipient falls back to one rich message when video is unavailable", async () => {
  let richVideoCalls = 0;
  const richAttempts: Array<{ chatId: string; html: string }> = [];
  const errors: unknown[] = [];

  const result = await notifySubscriptionGiftRecipient(
    {
      activated: true,
      newlyConfirmed: true,
      isGift: true,
      premiumExpiresAt: new Date("2027-08-27T12:00:00.000Z"),
      payer: { displayName: "Payer" },
      recipient: {
        id: 20,
        telegramId: 222n,
        languageCode: "en",
      },
    },
    {
      botUsername: "FavorDealsBot",
      sendRichVideoMessage: async () => {
        richVideoCalls += 1;
        throw Object.assign(new Error("gift video is missing"), {
          code: "ENOENT",
        });
      },
      sendRichMessage: async (chatId: string | number, html: string) => {
        richAttempts.push({ chatId: String(chatId), html });
        return { message_id: 456 };
      },
      logError: (...args: unknown[]) => errors.push(args),
    },
  );

  assert.deepEqual(result, { sent: true, transport: "rich" });
  assert.equal(richVideoCalls, 1);
  assert.equal(richAttempts.length, 1);
  assert.equal(richAttempts[0].chatId, "222");
  assert.doesNotMatch(richAttempts[0].html, /<video/);
  assert.match(richAttempts[0].html, /Up to 5 active contracts/);
  assert.equal(errors.length, 1);
});

test("gift recipient delivery stays best-effort when both rich attempts fail", async () => {
  let richVideoCalls = 0;
  let richCalls = 0;
  const errors: unknown[] = [];

  const result = await notifySubscriptionGiftRecipient(
    {
      activated: true,
      newlyConfirmed: true,
      isGift: true,
      payer: { displayName: "Payer" },
      recipient: {
        id: 20,
        telegramId: 222n,
        languageCode: "en",
      },
    },
    {
      sendRichVideoMessage: async () => {
        richVideoCalls += 1;
        return false;
      },
      sendRichMessage: async () => {
        richCalls += 1;
        return false;
      },
      logError: (...args: unknown[]) => errors.push(args),
    },
  );

  assert.deepEqual(result, { sent: false, reason: "delivery_failed" });
  assert.equal(richVideoCalls, 1);
  assert.equal(richCalls, 1);
  assert.equal(errors.length, 2);
});

test("payer notification failure cannot block a fulfilled Stars update", async () => {
  const errors: unknown[] = [];

  await sendSuccessfulPaymentMessages(
    { chat: { id: 111 } },
    "en",
    {
      activated: true,
      newlyConfirmed: true,
      isGift: false,
      payer: { id: 10, displayName: "Payer" },
      recipient: { id: 10, displayName: "Payer" },
    },
    {
      sendTextMessage: async () => {
        throw new Error("payer blocked bot");
      },
      logError: (...args: unknown[]) => errors.push(args),
    },
  );

  assert.equal(errors.length, 1);
});

test("subscription runtime extends from a future expiration, not payment time", () => {
  assert.deepEqual(SUBSCRIPTION_DURATIONS, ["1m", "1y"]);
  assert.equal(MONTHLY_SUBSCRIPTION_DURATION, "1m");
  assert.equal(YEARLY_SUBSCRIPTION_DURATION, "1y");
  assert.equal(FAVOR_SUBSCRIPTION_DURATION, YEARLY_SUBSCRIPTION_DURATION);
  const period = resolveSubscriptionPeriod({
    paymentAt: new Date("2026-09-01T00:00:00.000Z"),
    currentExpiresAt: new Date("2026-10-01T00:00:00.000Z"),
    duration: "1y",
  });

  assert.equal(period.startsAt.toISOString(), "2026-10-01T00:00:00.000Z");
  assert.equal(period.endsAt.toISOString(), "2027-10-01T00:00:00.000Z");
});

test("subscription calendar periods clamp month-end in UTC and preserve time", () => {
  assert.equal(
    addSubscriptionPeriod(
      new Date("2025-01-31T21:45:30.123Z"),
      "1m",
    ).toISOString(),
    "2025-02-28T21:45:30.123Z",
  );
  assert.equal(
    addSubscriptionPeriod(
      new Date("2024-02-29T06:15:05.456Z"),
      "1y",
    ).toISOString(),
    "2025-02-28T06:15:05.456Z",
  );
});

test("cron and bot image keep runtime, media, and deployment contracts", () => {
  const routeSource = readFileSync(
    path.resolve("src/app/api/cron/revalidate-expired-premium/route.ts"),
    "utf8",
  );
  const transactionSource = routeSource.slice(
    routeSource.indexOf("const [updatedUsers, updatedContracts]"),
  );
  assert.match(
    transactionSource,
    /user\.updateMany\([\s\S]*?isPremium:\s*true,[\s\S]*?premiumExpiresAt:\s*\{\s*lt:\s*now\s*\}/,
  );
  assert.match(
    transactionSource,
    /contract\.updateMany\([\s\S]*?author:\s*\{\s*premiumExpiresAt:\s*\{\s*lt:\s*now\s*\}/,
  );
  assert.match(transactionSource, /usersUpdated:\s*updatedUsers\.count/);
  assert.match(transactionSource, /contractsUpdated:\s*updatedContracts\.count/);

  const dockerfile = readFileSync(path.resolve("bot/Dockerfile"), "utf8");
  assert.match(
    dockerfile,
    /COPY src\/shared\/lib\/subscription\/runtime\.cjs \.\/src\/shared\/lib\/subscription\/runtime\.cjs/,
  );
  assert.match(
    dockerfile,
    /COPY src\/entities\/subscription \.\/src\/entities\/subscription/,
  );
  assert.match(
    dockerfile,
    /COPY src\/shared\/config\/contract-limits \.\/src\/shared\/config\/contract-limits/,
  );
  assert.match(
    dockerfile,
    /COPY src\/shared\/lib\/telegram\/rich-message\.runtime\.cjs \.\/src\/shared\/lib\/telegram\/rich-message\.runtime\.cjs/,
  );
  assert.match(dockerfile, /COPY bot \.\/bot/);

  const video = readFileSync(
    path.resolve("bot/assets/favor-plus-gift.mp4"),
  );
  assert.ok(video.length > 0, "gift video must not be empty");
  assert.ok(
    video.length < 50 * 1024 * 1024,
    "gift video must stay below Telegram's 50 MB limit",
  );
  assert.equal(video.subarray(4, 8).toString("ascii"), "ftyp");
});

test("subscription beneficiary migration backfills and enforces ownership invariants", () => {
  const migration = readFileSync(
    path.resolve(
      "prisma/migrations/20260827190000_subscription_beneficiaries/migration.sql",
    ),
    "utf8",
  );

  assert.match(
    migration,
    /UPDATE "PaymentIntent"\s+SET "beneficiaryUserId" = "userId"\s+WHERE "product" = 'subscription'/,
  );
  assert.match(
    migration,
    /"product" = 'subscription' AND "beneficiaryUserId" IS NOT NULL/,
  );
  assert.match(
    migration,
    /"product" <> 'subscription' AND "beneficiaryUserId" IS NULL/,
  );
  assert.match(
    migration,
    /CREATE UNIQUE INDEX "PaymentIntent_userId_idempotencyKey_key"\s+ON "PaymentIntent"\("userId", "idempotencyKey"\)/,
  );
  assert.match(
    migration,
    /FOREIGN KEY \("beneficiaryUserId"\) REFERENCES "User"\("id"\)\s+ON DELETE RESTRICT/,
  );
});

test("prepare schemas require UUID attempts while confirm schemas cannot retarget recipient", () => {
  const contractsSource = readFileSync(
    path.resolve("src/features/favor-subscription/server/contracts.ts"),
    "utf8",
  );
  assert.match(contractsSource, /checkoutAttemptIdSchema = z\.string\(\)\.uuid\(\)/);

  for (const schemaName of [
    "invoiceCheckoutSchema",
    "tonCheckoutSchema",
    "favorCheckoutSchema",
  ]) {
    const schema = contractsSource.match(
      new RegExp(
        `export const ${schemaName} = z\\.object\\(\\{([\\s\\S]*?)\\}\\)\\.strict\\(\\);`,
      ),
    );
    assert.ok(schema, `${schemaName} source contract must exist`);
    assert.match(schema[1], /checkoutAttemptId:\s*checkoutAttemptIdSchema/);
  }

  const favorPrepare = contractsSource.match(
    /export const favorCheckoutSchema = z\.object\(\{([\s\S]*?)\}\)\.strict\(\);/,
  );
  assert.ok(favorPrepare);
  assert.match(
    favorPrepare[1],
    /duration:\s*z\.literal\(FAVOR_SUBSCRIPTION_DURATION\)/,
  );
  assert.match(
    contractsSource,
    /duration:\s*z\.enum\(SUBSCRIPTION_DURATIONS\)/,
  );

  for (const schemaName of ["tonConfirmationSchema", "favorConfirmationSchema"]) {
    const schema = contractsSource.match(
      new RegExp(
        `export const ${schemaName} = z\\.object\\(\\{([\\s\\S]*?)\\}\\)\\.strict\\(\\);`,
      ),
    );
    assert.ok(schema, `${schemaName} source contract must exist`);
    assert.doesNotMatch(schema[1], /recipient|beneficiary/i);
    assert.doesNotMatch(schema[1], /checkoutAttemptId/);
  }
});

test("pending checkout expiration follows the server payment intent", () => {
  const checkoutSource = readFileSync(
    path.resolve("src/features/favor-subscription/server/checkout.ts"),
    "utf8",
  );
  const pendingSource = readFileSync(
    path.resolve(
      "src/features/favor-subscription/model/pending-subscription.ts",
    ),
    "utf8",
  );
  const checkoutHookSource = readFileSync(
    path.resolve(
      "src/features/favor-subscription/model/use-favor-subscription-checkout.ts",
    ),
    "utf8",
  );
  const statusSource = readFileSync(
    path.resolve("src/features/favor-subscription/server/status.ts"),
    "utf8",
  );
  const reconciliationSource = readFileSync(
    path.resolve(
      "src/features/favor-subscription/server/reconciliation.ts",
    ),
    "utf8",
  );

  assert.match(checkoutSource, /expiresAt:\s*intent\.expiresAt/);
  assert.match(pendingSource, /expiresAt:\s*string/);
  assert.doesNotMatch(
    pendingSource,
    /Date\.parse\([^)]*expiresAt[^)]*\)\s*<=\s*Date\.now\(\)/,
  );
  assert.match(statusSource, /terminal:/);
  assert.match(statusSource, /serverTime:\s*now/);
  assert.match(
    reconciliationSource,
    /intent\.expiresAt\.getTime\(\)\s*\+\s*ONCHAIN_RECONCILIATION_GRACE_MS/,
  );
  assert.equal(
    checkoutHookSource.match(/expiresAt:\s*prepared\.expiresAt/g)?.length,
    3,
  );
  assert.doesNotMatch(pendingSource, /15\s*\*\s*60\s*\*\s*1000/);
});

test("FAVOR prepare and Stars pricing fail closed while invoice payload stays one-charge", () => {
  const checkoutSource = readFileSync(
    path.resolve("src/features/favor-subscription/server/checkout.ts"),
    "utf8",
  );
  const pricingSource = readFileSync(
    path.resolve("src/shared/lib/pricing.ts"),
    "utf8",
  );

  assert.match(checkoutSource, /getLiveFavorPriceInGram\(\)/);
  assert.match(
    checkoutSource,
    /"FAVOR_QUOTE_UNAVAILABLE"[\s\S]*?503/,
  );
  assert.doesNotMatch(checkoutSource, /getFavorPriceUsdt/);
  assert.match(
    checkoutSource,
    /atomically claims providerSubmissionId[\s\S]*?at most one Stars charge/,
  );
  assert.match(
    pricingSource,
    /requirePositivePrice\(env\.telegramStarsPerUsdt\)/,
  );
  assert.match(pricingSource, /Number\.isSafeInteger\(amount\)/);
});
