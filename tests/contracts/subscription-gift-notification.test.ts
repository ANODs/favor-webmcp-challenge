import assert from "node:assert/strict";
import test from "node:test";

import { notifyConfirmedSubscriptionGift } from "../../src/features/favor-subscription/server/gift-notification";

const createConfirmedGift = () => ({
  userId: 10,
  beneficiaryUserId: 20,
  user: {
    id: 10,
    name: null,
    telegramUsername: "payer",
    telegramFirstName: "Payer",
    telegramLastName: "Name",
  },
  beneficiary: {
    id: 20,
    telegramId: 222n,
    languageCode: "en-US",
  },
  subscriptionPurchase: {
    endsAt: new Date("2027-08-27T12:00:00.000Z"),
  },
});

test("confirmed TON/FAVOR gift notification sends one video-first rich message", async () => {
  const richVideoDeliveries: Array<Record<string, unknown>> = [];
  let richFallbackDeliveries = 0;
  let loadedIntentId: string | null = null;

  const result = await notifyConfirmedSubscriptionGift(
    { intentId: "intent-ton-gift", newlyConfirmed: true },
    {
      botUsername: "@FavorDealsBot",
      loadConfirmedIntent: async (intentId) => {
        loadedIntentId = intentId;
        return createConfirmedGift();
      },
      loadVideo: async () => Uint8Array.of(0, 1, 2, 3),
      sendRichVideo: async (message) => {
        richVideoDeliveries.push(message);
        return { messageId: 123 };
      },
      sendRichMessage: async () => {
        richFallbackDeliveries += 1;
        return { messageId: 456 };
      },
    },
  );

  assert.deepEqual(result, { sent: true });
  assert.equal(loadedIntentId, "intent-ton-gift");
  assert.equal(richFallbackDeliveries, 0);
  assert.equal(richVideoDeliveries.length, 1);
  const delivery = richVideoDeliveries[0];
  assert.equal(delivery.chatId, "222");
  assert.deepEqual(delivery.video, Uint8Array.of(0, 1, 2, 3));
  assert.equal(delivery.filename, "favor-plus-gift.mp4");
  assert.equal(delivery.mediaId, "favor_plus_gift_video");
  assert.equal(delivery.attachmentName, "favor_plus_gift_video_file");
  assert.equal(delivery.width, 720);
  assert.equal(delivery.height, 720);
  assert.equal(delivery.duration, 6);
  assert.equal(typeof delivery.html, "string");
  assert.ok(String(delivery.html).startsWith("<video"));
  assert.match(String(delivery.html), /From: Payer Name/);
  assert.match(String(delivery.html), /Up to 50 scout contracts/);
  assert.ok(String(delivery.html).endsWith("</tg-button-row>"));
});

test("gift notification ignores duplicate confirmations and self purchases", async () => {
  let loadCalls = 0;
  let sendCalls = 0;
  const dependencies = {
    loadConfirmedIntent: async () => {
      loadCalls += 1;
      const intent = createConfirmedGift();
      return {
        ...intent,
        beneficiaryUserId: intent.userId,
        beneficiary: { ...intent.beneficiary, id: intent.userId },
      };
    },
    sendRichMessage: async () => {
      sendCalls += 1;
      return { messageId: 1 };
    },
  };

  assert.deepEqual(
    await notifyConfirmedSubscriptionGift(
      { intentId: "duplicate", newlyConfirmed: false },
      dependencies,
    ),
    { sent: false, reason: "not_new_gift" },
  );
  assert.equal(loadCalls, 0);

  assert.deepEqual(
    await notifyConfirmedSubscriptionGift(
      { intentId: "self", newlyConfirmed: true },
      dependencies,
    ),
    { sent: false, reason: "gift_not_found" },
  );
  assert.equal(loadCalls, 1);
  assert.equal(sendCalls, 0);
});

test("gift notification is best-effort when confirmed intent lookup fails", async () => {
  const errors: unknown[] = [];
  const logError = (...args: unknown[]) => errors.push(args);

  assert.deepEqual(
    await notifyConfirmedSubscriptionGift(
      { intentId: "lookup-failure", newlyConfirmed: true },
      {
        loadConfirmedIntent: async () => {
          throw new Error("database temporarily unavailable");
        },
        logError,
      },
    ),
    { sent: false, reason: "delivery_failed" },
  );
  assert.equal(errors.length, 1);
});

test("gift notification falls back to one rich message without video", async () => {
  const scenarios = [
    {
      name: "missing video file",
      loadVideo: async () => {
        throw Object.assign(new Error("gift video is missing"), {
          code: "ENOENT",
        });
      },
      sendRichVideo: async () => {
        throw new Error("sendRichVideo must not run without media");
      },
      expectedRichVideoCalls: 0,
    },
    {
      name: "Telegram rejects rich video",
      loadVideo: async () => Uint8Array.of(0, 1, 2),
      sendRichVideo: async () => false as const,
      expectedRichVideoCalls: 1,
    },
  ];

  for (const scenario of scenarios) {
    let richVideoCalls = 0;
    const richFallbacks: string[] = [];
    const errors: unknown[] = [];

    const result = await notifyConfirmedSubscriptionGift(
      { intentId: `fallback-${scenario.name}`, newlyConfirmed: true },
      {
        loadConfirmedIntent: async () => createConfirmedGift(),
        loadVideo: scenario.loadVideo,
        sendRichVideo: async () => {
          richVideoCalls += 1;
          return scenario.sendRichVideo();
        },
        sendRichMessage: async ({ html }) => {
          richFallbacks.push(html);
          return { messageId: 456 };
        },
        logError: (...args: unknown[]) => errors.push(args),
      },
    );

    assert.deepEqual(result, { sent: true }, scenario.name);
    assert.equal(
      richVideoCalls,
      scenario.expectedRichVideoCalls,
      scenario.name,
    );
    assert.equal(richFallbacks.length, 1, scenario.name);
    assert.doesNotMatch(richFallbacks[0], /<video/, scenario.name);
    assert.match(richFallbacks[0], /Unlimited contact views/, scenario.name);
    assert.ok(richFallbacks[0].endsWith("</tg-button-row>"), scenario.name);
    assert.equal(errors.length, 1, scenario.name);
  }
});

test("gift notification remains best-effort when both rich deliveries fail", async () => {
  let richVideoCalls = 0;
  let richCalls = 0;
  const errors: unknown[] = [];

  assert.deepEqual(
    await notifyConfirmedSubscriptionGift(
      { intentId: "delivery-failure", newlyConfirmed: true },
      {
        loadConfirmedIntent: async () => createConfirmedGift(),
        loadVideo: async () => Uint8Array.of(0, 1, 2),
        sendRichVideo: async () => {
          richVideoCalls += 1;
          throw new Error("Telegram rich video upload failed");
        },
        sendRichMessage: async () => {
          richCalls += 1;
          throw new Error("recipient blocked the bot");
        },
        logError: (...args: unknown[]) => errors.push(args),
      },
    ),
    { sent: false, reason: "delivery_failed" },
  );
  assert.equal(richVideoCalls, 1);
  assert.equal(richCalls, 1);
  assert.equal(errors.length, 2);
});
