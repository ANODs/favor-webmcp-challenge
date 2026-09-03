/* eslint-disable @typescript-eslint/no-require-imports */
import assert from "node:assert/strict";
import test from "node:test";

// These bot modules are CommonJS because the production bot runs directly in Node.js.
const {
  buildReportPreview,
  buildReportPreviewButtons,
  parseReportCallback,
} = require("../../bot/src/features/handle-report-command/preview");
const {
  buildSupportTicketRichMessage,
} = require("../../bot/src/features/handle-report-command/ticket");

test("report preview keeps the submit action directly under current ticket data", () => {
  const session = {
    id: "session_123",
    source: "Команда /report",
    errorCode: null,
    descriptionParts: ["Не открывается сделка", "Ошибка после оплаты"],
    contactLabel: "Test User",
    hasContact: true,
    hasDescription: true,
    photoCount: 1,
  };

  const preview = buildReportPreview(session);
  const buttons = buildReportPreviewButtons(session.id);

  assert.match(preview, /🧾 Превью тикета/);
  assert.match(preview, /Не открывается сделка\n\nОшибка после оплаты/);
  assert.match(preview, /Контакт: Test User/);
  assert.match(preview, /Фотографии: 1/);
  assert.deepEqual(buttons[0], {
    text: "✅ Отправить тикет",
    callback_data: "report:submit:session_123",
  });
  assert.deepEqual(parseReportCallback(buttons[0].callback_data), {
    action: "submit",
    sessionId: "session_123",
  });
  assert.equal(parseReportCallback("report:submit:"), null);
  assert.equal(parseReportCallback("another:submit:session_123"), null);
});

test("support ticket is one rich message with Telegram-hosted photos", () => {
  const ticket = buildSupportTicketRichMessage(
    {
      source: "Команда /report",
      errorCode: "PAYMENT_42",
      descriptionParts: ["Кнопка <Оплатить> не работает & зависает"],
      contact: {
        first_name: "Test",
        phone_number: "+12025550123",
      },
      photoFileIds: ["telegram-file-id-1", "telegram-file-id-2"],
    },
    {
      id: 42424242,
      first_name: "Test",
      username: "test_user",
    },
  );

  assert.match(ticket.html, /<h1>🆘 Новый тикет Favor<\/h1>/);
  assert.match(ticket.html, /<table bordered striped>/);
  assert.match(ticket.html, /Кнопка &lt;Оплатить&gt; не работает &amp; зависает/);
  assert.match(ticket.html, /href="tel:\+12025550123"/);
  assert.match(ticket.html, /<tg-collage>/);
  assert.match(ticket.html, /tg:\/\/photo\?id=ticket_photo_1/);
  assert.deepEqual(ticket.media, [
    {
      id: "ticket_photo_1",
      media: { type: "photo", media: "telegram-file-id-1" },
    },
    {
      id: "ticket_photo_2",
      media: { type: "photo", media: "telegram-file-id-2" },
    },
  ]);
});

test("report preview and rich ticket support English", () => {
  const session = {
    id: "session_en",
    locale: "en",
    source: "Command /report",
    errorCode: null,
    descriptionParts: ["Checkout is stuck"],
    contact: null,
    contactLabel: null,
    hasContact: false,
    hasDescription: true,
    photoCount: 0,
    photoFileIds: [],
  };

  const preview = buildReportPreview(session);
  const buttons = buildReportPreviewButtons(session.id, session.locale);
  const ticket = buildSupportTicketRichMessage(session, {
    id: 42424242,
    first_name: "Test",
  });

  assert.match(preview, /🧾 Ticket preview/);
  assert.match(preview, /Contact: not added/);
  assert.equal(buttons[0].text, "✅ Submit ticket");
  assert.match(ticket.html, /<h1>🆘 New Favor ticket<\/h1>/);
  assert.match(ticket.html, /<h2>Problem description<\/h2>/);
  assert.doesNotMatch(ticket.html, /Новый тикет/);
});

test("automatic client diagnostics are visible in preview and support ticket", () => {
  const session = {
    id: "session_diagnostic",
    locale: "ru",
    source: "Mini App · telegram-story",
    errorCode: "STORY_SCENE_INIT_FAILED",
    diagnosticPublicId: "report_public_id",
    descriptionParts: ["Автоматический отчёт STORY_SCENE_INIT_FAILED (ABC1234)."],
    contact: null,
    photoFileIds: [],
    photoCount: 0,
    diagnosticPayload: {
      id: "local-report-id",
      code: "STORY_SCENE_INIT_FAILED",
      fingerprint: "ABC1234",
      area: "telegram-story",
      route: "/ru/profile/me",
      timestamp: "2026-08-21T01:00:00.000Z",
      context: { platform: "ios", telegramVersion: "12.0" },
      breadcrumbs: [
        {
          timestamp: "2026-08-21T01:00:00.000Z",
          category: "story",
          name: "scene-init",
          outcome: "failure",
        },
      ],
      stack: "Error: WebGL context unavailable",
    },
  };

  const preview = buildReportPreview(session);
  const ticket = buildSupportTicketRichMessage(session, {
    id: 42424242,
    first_name: "Test",
  });

  assert.match(preview, /Диагностика: приложена автоматически/);
  assert.match(ticket.html, /Автоматическая диагностика/);
  assert.match(ticket.html, /report_public_id/);
  assert.match(ticket.html, /platform: ios/);
  assert.match(ticket.html, /story\/scene-init · failure/);
  assert.match(ticket.html, /WebGL context unavailable/);
});
