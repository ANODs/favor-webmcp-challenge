import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyContractText,
  collectTelegramScouting,
  dedupeScoutedPosts,
  extractScoutingContacts,
  extractTelegramContacts,
  extractTelegramUsernameFromUrl,
  normalizeScoutedPost,
  parseScoutingInput,
  parseTelegramChannelPage,
  resolveDateWindow,
  sanitizeContractText,
} from "../../scripts/telegram-scouting";
import type {
  NormalizedChannelConfig,
  ParsedTelegramPost,
} from "../../scripts/telegram-scouting";
import { parseCliArgs } from "../../scripts/telegram-scouting/cli";

const channelHandle = "zz_test_only_channel";
const authorHandle = "zz_test_only_author";
const advertisingHandle = "zz_test_only_ads";

const telegramPage = (posts: string) => `<!doctype html>
<html>
  <head><meta property="og:url" content="https://t.me/${channelHandle}"></head>
  <body>
    <div class="tgme_channel_info_header_title">QA Freelance Channel</div>
    <div class="tgme_channel_info_description">По рекламе: @${advertisingHandle}</div>
    <div class="tgme_channel_info_counter"><span class="counter_value">12K</span></div>
    ${posts}
  </body>
</html>`;

const telegramPostHtml = (input: {
  id: number;
  datetime: string;
  username: string;
  body?: string;
}) => `
<div class="tgme_widget_message" data-post="${channelHandle}/${input.id}">
  <a class="tgme_widget_message_date"><time datetime="${input.datetime}"></time></a>
  <div class="tgme_widget_message_text">
    <b>#Удаленка Требуется разработчик</b><br><br>
    ${input.body ?? "Нужно разработать сайт. Бюджет и сроки обсудим с исполнителем."}<br>
    Если вакансия интересна, напишите нам.<br>
    <a href="https://t.me/${input.username}">Написать автору</a>
  </div>
  <a class="tgme_widget_message_inline_button" href="tg://resolve?domain=${input.username}">
    <span>Связаться</span>
  </a>
</div>`;

const parsedConfig = (): NormalizedChannelConfig =>
  parseScoutingInput({
    channels: [
      {
        handle: `@${channelHandle}`,
        topic: "development",
        category: "Development",
        advertisingContacts: [advertisingHandle],
      },
    ],
    requestDelayMs: 0,
  }).channels[0];

test("parses canonical Telegram post data, inline links, buttons, and description contacts", () => {
  const parsed = parseTelegramChannelPage(
    telegramPage(
      telegramPostHtml({
        id: 101,
        datetime: "2026-08-24T10:30:00+00:00",
        username: authorHandle,
      }),
    ),
    channelHandle,
  );

  assert.equal(parsed.metadata.handle, channelHandle);
  assert.equal(parsed.metadata.title, "QA Freelance Channel");
  assert.equal(parsed.metadata.subscriberText, "12K");
  assert.deepEqual(parsed.metadata.descriptionContacts, [
    {
      type: "telegram",
      value: advertisingHandle,
      username: advertisingHandle,
      kind: "advertising",
      context: `По рекламе: @${advertisingHandle}`,
    },
  ]);
  assert.equal(parsed.posts.length, 1);
  assert.equal(parsed.posts[0].postUrl, `https://t.me/${channelHandle}/101`);
  assert.equal(parsed.posts[0].publishedAt, "2026-08-24T10:30:00.000Z");
  assert.deepEqual(parsed.posts[0].contacts, [
    {
      type: "telegram",
      value: authorHandle,
      username: authorHandle,
      sources: ["button", "inline_link"],
      evidence: [
        `Написать автору: https://t.me/${authorHandle}`,
        `Связаться: tg://resolve?domain=${authorHandle}`,
      ],
    },
  ]);
});

test("does not treat a generic channel-navigation button as an author contact", () => {
  const html = telegramPage(`
    <div class="tgme_widget_message" data-post="${channelHandle}/150">
      <a class="tgme_widget_message_date"><time datetime="2026-08-24T10:30:00Z"></time></a>
      <div class="tgme_widget_message_text">Требуется специалист для долгосрочного проекта.</div>
      <a class="tgme_widget_message_inline_button" href="https://t.me/zz_test_only_linked_channel">
        Подписаться на канал
      </a>
    </div>`);
  const [post] = parseTelegramChannelPage(html, channelHandle).posts;

  assert.equal(post.buttons.length, 1);
  assert.deepEqual(post.contacts, []);
});

test("rejects Telegram service routes and subscription footer links as contacts", () => {
  for (const route of [
    "addlist/list-token",
    "joinchat/invite-token",
    "share/url?url=https://example.invalid",
    "proxy?server=example.invalid",
    "socks?server=example.invalid",
    "login/example",
    "setlanguage/ru",
    "+invite-token",
    "iv/example",
    "c/123/456",
  ]) {
    assert.equal(
      extractTelegramUsernameFromUrl(`https://t.me/${route}`),
      null,
      route,
    );
  }
  assert.equal(
    extractTelegramUsernameFromUrl("https://t.me/s/real_public_channel"),
    "real_public_channel",
  );
  assert.equal(
    extractTelegramUsernameFromUrl("https://t.me/real_public_author/42"),
    "real_public_author",
  );

  const contacts = extractTelegramContacts({
    text: "Подписаться на наши каналы: @best_itjob @it_rab",
    inlineLinks: [
      {
        text: "Подписаться на наши каналы",
        url: "https://t.me/addlist/list-token",
      },
      { text: "@best_itjob", url: "https://t.me/best_itjob" },
      { text: "@it_rab", url: "https://t.me/it_rab" },
    ],
    buttons: [],
  });
  assert.deepEqual(contacts, []);
});

test("keeps only explicitly labelled author Telegram contacts", () => {
  const contacts = extractTelegramContacts({
    text: `Для отклика пишите @real_public_author
Лучший сервис: @unrelated_footer
Наши каналы: @network_footer`,
    inlineLinks: [
      { text: "@real_public_author", url: "https://t.me/real_public_author" },
      { text: "Лучший сервис", url: "https://t.me/unrelated_footer" },
      { text: "Наши каналы", url: "https://t.me/network_footer" },
    ],
    buttons: [],
  });

  assert.deepEqual(
    contacts.map((contact) => contact.username),
    ["real_public_author"],
  );
});

test("uses a later explicit CTA when a username first appears in navigation", () => {
  const repeatedHandle = "real_repeated_author";
  const contacts = extractTelegramContacts({
    text: `Наш канал: @${repeatedHandle}
Требуется дизайнер для подготовки интерфейсов продукта.
Для отклика пишите @${repeatedHandle}`,
    inlineLinks: [],
    buttons: [],
  });

  assert.deepEqual(
    contacts.map((contact) => contact.username),
    [repeatedHandle],
  );
  assert.match(contacts[0].evidence.join("\n"), /Для отклика/iu);
});

test("does not reinterpret an @handle linked to VK or Instagram as Telegram", () => {
  const contacts = extractTelegramContacts({
    text: "Для связи в ВК: @nata_karz",
    inlineLinks: [
      { text: "@nata_karz", url: "https://vk.com/id32116963" },
    ],
    buttons: [],
  });

  assert.deepEqual(contacts, []);
});

test("extracts real phones without accepting salary, IDs, URLs, or line joins", () => {
  const valid = extractScoutingContacts({
    text: `Откликнуться: по номеру +12025550111
Контакт: +12025550112
Телефон: +12025550113
27. Следующий пункт`,
    inlineLinks: [],
    buttons: [],
  });
  assert.deepEqual(
    valid
      .filter((contact) => contact.type === "phone")
      .map((contact) => contact.value)
      .sort(),
    ["+12025550111", "+12025550112", "+12025550113"],
  );

  const salaryCases = [
    ["https://t.me/yuniorapp/4923", "4000080000"],
    ["https://t.me/yuniorapp/4918", "100000110000"],
    ["https://t.me/rueventjob/18454", "70000120000"],
    ["https://t.me/work4writers/4073", "60000100000"],
    ["https://t.me/talentedpeoples/33769", "250000350000"],
    ["https://t.me/yuniorapp/4847", "800000016000000"],
  ] as const;
  for (const [url, digits] of salaryCases) {
    const contacts = extractScoutingContacts({
      text: `З/П: ${digits} ₽`,
      inlineLinks: [],
      buttons: [],
    });
    assert.equal(
      contacts.some((contact) => contact.type === "phone"),
      false,
      url,
    );
  }

  const numericNoiseCases = [
    ["https://t.me/designhunters/7645", "https://example.invalid/437348349343403"],
    ["https://t.me/designhunters/7610", "https://example.invalid/1129216929"],
    ["https://t.me/it_vakansii_jobs/3137", "ИНН: 7729779476"],
    ["https://t.me/it_vakansii_jobs/3117", "ИНН: 771618975809"],
    ["https://t.me/workinart/10500", "Дата: 140807092026"],
    ["https://t.me/talentedpeoples/33889", "ID вакансии: 1323224612"],
  ] as const;
  for (const [url, text] of numericNoiseCases) {
    const contacts = extractScoutingContacts({
      text,
      inlineLinks: [],
      buttons: [],
    });
    assert.equal(
      contacts.some((contact) => contact.type === "phone"),
      false,
      url,
    );
  }
});

test("keeps advertising email, phone, and form URL from a channel description", () => {
  const html = `<!doctype html><html><head>
    <meta property="og:url" content="https://t.me/${channelHandle}">
  </head><body>
    <div class="tgme_channel_info_description">
      Реклама: <a href="mailto:ads@example.invalid">ads@example.invalid</a><br>
      Реклама, форма: <a href="https://example.invalid/ad-form">заполнить форму</a><br>
      По рекламе: +1 (202) 555-0114
    </div>
  </body></html>`;
  const contacts = parseTelegramChannelPage(html, channelHandle).metadata
    .descriptionContacts;

  assert.deepEqual(
    contacts.map(({ type, value, kind }) => ({ type, value, kind })),
    [
      { type: "email", value: "ads@example.invalid", kind: "advertising" },
      { type: "phone", value: "+12025550114", kind: "advertising" },
      {
        type: "url",
        value: "https://example.invalid/ad-form",
        kind: "advertising",
      },
    ],
  );
});

test("recognizes nonstandard advertising and channel-team description markers", () => {
  const moderatorHandle = "zz_test_only_moderator";
  const html = `<!doctype html><html><head>
    <meta property="og:url" content="https://t.me/${channelHandle}">
  </head><body>
    <div class="tgme_channel_info_description">
      Публикация вакансий: jobs@example.invalid<br>
      Предложить вакансию: <a href="https://example.invalid/job-form">форма</a><br>
      Модератор: @${moderatorHandle}<br>
      Для связи: +7 (000) 111-22-33
    </div>
  </body></html>`;
  const contacts = parseTelegramChannelPage(html, channelHandle).metadata
    .descriptionContacts;
  const byValue = new Map(contacts.map((contact) => [contact.value, contact]));

  assert.equal(byValue.get("jobs@example.invalid")?.kind, "advertising");
  assert.equal(byValue.get("https://example.invalid/job-form")?.kind, "advertising");
  assert.equal(byValue.get(moderatorHandle)?.kind, "admin");
  assert.equal(byValue.get("+70001112233")?.kind, "admin");
});

test("configured advertising identity promotes an extracted other contact", async () => {
  const promotedEmail = "promotion@example.invalid";
  const config = parseScoutingInput({
    channels: [
      {
        handle: channelHandle,
        advertisingContacts: [promotedEmail, "telega.invalid/listing"],
      },
    ],
    requestDelayMs: 0,
  });
  const page = `<!doctype html><html><head>
    <meta property="og:url" content="https://t.me/${channelHandle}">
  </head><body>
    <div class="tgme_channel_info_description">Контакт канала: ${promotedEmail}</div>
  </body></html>`;
  const fetcher = (async () => new Response(page, { status: 200 })) as typeof fetch;
  const artifact = await collectTelegramScouting({
    ...config,
    from: new Date("2026-08-01T00:00:00Z"),
    to: new Date("2026-08-25T00:00:00Z"),
    fetcher,
  });
  const promoted = artifact.channels[0].descriptionContacts.find(
    (contact) => contact.value === promotedEmail,
  );

  assert.equal(promoted?.kind, "advertising");
  assert.equal(promoted?.context, `Контакт канала: ${promotedEmail}`);
  assert.deepEqual(
    artifact.channels[0].outreachContacts.map((contact) => contact.value),
    ["https://telega.invalid/listing", promotedEmail],
  );
});

test("omits posts whose only contact belongs to the channel description", async () => {
  const sharedEmail = "shared@example.invalid";
  const page = `<!doctype html><html><head>
    <meta property="og:url" content="https://t.me/${channelHandle}">
  </head><body>
    <div class="tgme_channel_info_description">Контакт канала: ${sharedEmail}</div>
    <div class="tgme_widget_message" data-post="${channelHandle}/155">
      <a class="tgme_widget_message_date"><time datetime="2026-08-24T10:30:00Z"></time></a>
      <div class="tgme_widget_message_text">
        Требуется разработчик для нового проекта.<br>
        Нужно собрать интерфейс и подключить API.<br>
        Для связи: ${sharedEmail}
      </div>
    </div>
  </body></html>`;
  const fetcher = (async () => new Response(page, { status: 200 })) as typeof fetch;
  const artifact = await collectTelegramScouting({
    channels: [parsedConfig()],
    from: new Date("2026-08-01T00:00:00Z"),
    to: new Date("2026-08-25T00:00:00Z"),
    maxPagesPerChannel: 1,
    requestDelayMs: 0,
    fetcher,
  });

  assert.equal(artifact.channels[0].descriptionContacts[0].kind, "other");
  assert.equal(artifact.summary.deduplicatedPostCount, 1);
  assert.equal(artifact.summary.contactEligiblePostCount, 0);
  assert.equal(artifact.summary.discardedNoDirectContactPostCount, 1);
  assert.deepEqual(artifact.posts, []);
});

test("email-only author contact stays review-eligible but requires manual Favor handoff", () => {
  const rawText = `Требуется иллюстратор для серии материалов.

Нужно подготовить десять иллюстраций в едином стиле.

Для связи: artist@example.invalid`;
  const post: ParsedTelegramPost = {
    channelHandle,
    channelUrl: `https://t.me/${channelHandle}`,
    postId: 160,
    postUrl: `https://t.me/${channelHandle}/160`,
    publishedAt: "2026-08-24T10:30:00.000Z",
    rawText,
    inlineLinks: [],
    buttons: [],
    contacts: [
      {
        type: "email",
        value: "artist@example.invalid",
        username: null,
        sources: ["text"],
        evidence: ["Для связи: artist@example.invalid"],
      },
    ],
  };
  const normalized = normalizeScoutedPost(post, parsedConfig());

  assert.equal(normalized.contacts.selected?.type, "email");
  assert.equal(normalized.contacts.selectedUsername, null);
  assert.equal(normalized.eligibility.reviewEligible, true);
  assert.equal(normalized.eligibility.favorPayloadReady, false);
  assert.deepEqual(normalized.eligibility.favorPayloadReasons, [
    "telegram_contact_required_manual_review",
  ]);
  assert.equal(normalized.favorDryRunPayload, null);
  assert.doesNotMatch(normalized.cleaned.cachedTelegramText, /example\.invalid/u);
});

test("removes contact footer blocks from public and cached Favor text", () => {
  const raw = `Требуется дизайнер интерфейсов

Нужно подготовить макеты мобильного приложения.

Если интересно, присылайте резюме.
📝 @${authorHandle}`;
  const cleaned = sanitizeContractText(raw);

  assert.equal(
    cleaned,
    "Требуется дизайнер интерфейсов\n\nНужно подготовить макеты мобильного приложения.",
  );
  assert.doesNotMatch(cleaned, /@|резюме/u);
});

test("removes known channel promo and reaction footer lines", () => {
  const raw = `Требуется дизайнер интерфейсов

Нужно подготовить макеты мобильного приложения и поддерживать дизайн-систему.

========
Разместить вакансию / рекламу / резюме
Получать больше вакансий — Работодром PRO
Подписаться на наши каналы
Мы также есть там: https://max.ru/example
👤 Вакансия из канала «Работа в медиа»
💙 Удалёнка
💚 Качнуть карьеру
💖 Дизайнерам 🟠 Маркетологам
🖤 HR 💜 QA 🟡 Менеджерам
Подробнее о вакансии по ссылке
Понравилась вакансия?
👍 Да
👎 Нет
➖➖➖➖➖➖`;

  assert.equal(
    sanitizeContractText(raw),
    "Требуется дизайнер интерфейсов\n\nНужно подготовить макеты мобильного приложения и поддерживать дизайн-систему.",
  );
});

test("removes an orphaned trailing contact heading", () => {
  const raw = `Требуется дизайнер интерфейсов

Нужно подготовить макеты мобильного приложения.

Как откликнуться:
Откликнуться: @${authorHandle}`;

  assert.equal(
    sanitizeContractText(raw),
    "Требуется дизайнер интерфейсов\n\nНужно подготовить макеты мобильного приложения.",
  );
});

test("removes original Telegram application instructions from a public contract", () => {
  const raw = `Требуется дизайнер интерфейсов

Нужно подготовить макеты мобильного приложения и поддерживать дизайн-систему.

Как проходит отбор:
Проводим короткое знакомство и обсуждаем задачи.

Как откликнуться:
Пришлите в ЛС резюме, портфолио и стоимость работы.`;

  assert.equal(
    sanitizeContractText(raw),
    `Требуется дизайнер интерфейсов

Нужно подготовить макеты мобильного приложения и поддерживать дизайн-систему.

Как проходит отбор:
Проводим короткое знакомство и обсуждаем задачи.`,
  );
});

test("removes an application section when its linked heading was already private", () => {
  const raw = `Ищем UI/UX-дизайнера

Нужно улучшать структуру экранов и навигацию мобильного приложения.

Чтобы откликнуться, напишите:
— почему вы подходите;
— приложите портфолио;
— укажите желаемую почасовую ставку.

Контакт: откликнуться`;
  const cleaned = sanitizeContractText(raw, {
    contactAnchorTexts: ["откликнуться"],
  });

  assert.equal(
    cleaned,
    "Ищем UI/UX-дизайнера\n\nНужно улучшать структуру экранов и навигацию мобильного приложения.",
  );
});

test("removes residual public contact tokens while preserving Telegram assets", () => {
  const raw = `Требуется Junior Product Manager

Нужно помогать продуктовой команде, проверять гипотезы и обновлять документацию.
Junior Product Manager / TG @revacancy
@example_contact / +1 202-555-0115
Тг: https://t.me/example_job_contact
Архив: t.me/rueventjob4at/vacancies
Команда: t.me/mooov_team
Телефон: +1 202-555-0116
Почта: author@example.invalid
📍Контактные данные:
Соцсети: канал https://t.me/estate_money
Сайт: https://tereshev.ru
Стикеры команды: https://t.me/addstickers/ProductTeam`;
  const cleaned = sanitizeContractText(raw);

  assert.equal(
    cleaned,
    `Требуется Junior Product Manager

Нужно помогать продуктовой команде, проверять гипотезы и обновлять документацию.
Стикеры команды: https://t.me/addstickers/ProductTeam`,
  );
  assert.doesNotMatch(cleaned, /@[A-Za-z][A-Za-z0-9_]+/u);
  assert.doesNotMatch(cleaned, /(?:t|telegram)\.me\/(?!addstickers\/)/iu);
  assert.doesNotMatch(cleaned, /\+(?:[ ().-]*\d){10,15}/u);
  assert.doesNotMatch(cleaned, /[\w.+-]+@[\w.-]+\.\w+/u);
  assert.doesNotMatch(cleaned, /tereshev\.ru|Контактные данные/iu);
});

test("payload-ready text removes unrecognized secondary contact labels", () => {
  const source = parseTelegramChannelPage(
    telegramPage(
      telegramPostHtml({
        id: 170,
        datetime: "2026-08-24T11:30:00Z",
        username: authorHandle,
        body: `Нужно разработать сайт и подключить систему оплаты.<br>
          Discord secondary#1234<br>
          Signal secondary_user<br>
          Мой юзернейм secondary_user`,
      }),
    ),
    channelHandle,
  ).posts[0];
  const normalized = normalizeScoutedPost(source, parsedConfig());
  const exposedText = [
    normalized.cleaned.publicText,
    normalized.cleaned.cachedTelegramText,
    normalized.favorDryRunPayload?.cachedTelegramText,
    normalized.favorDryRunPayload?.descriptionRu,
    normalized.favorDryRunPayload?.descriptionEn,
  ]
    .filter((value): value is string => typeof value === "string")
    .join("\n");

  assert.equal(normalized.eligibility.favorPayloadReady, true);
  assert.doesNotMatch(exposedText, /secondary|discord|signal|юзернейм/iu);
});

test("classifies specialist requests and strong first-person offers", () => {
  const order = classifyContractText(
    "Ищем разработчика в команду. Зарплата и задачи обсуждаются на встрече.",
  );

  assert.equal(order.type, "order");
  assert.equal(order.confidence, "high");

  const offerTexts = [
    "Ищу работу разработчиком. Есть коммерческие кейсы и рекомендации.",
    "Ищу заказы на разработку сайтов. Могу начать на этой неделе.",
    "Ищу проекты по UX-дизайну и продуктовым исследованиям.",
    "Предлагаю услуги редактора для B2B и технологических медиа.",
    "Возьму проект по созданию интернет-магазина под ключ.",
    "Открыт к предложениям по backend-разработке на Python.",
    "Открыта к предложениям по дизайну мобильных приложений.",
    "Рассматриваю проекты по настройке аналитики и дашбордов.",
    "Я готов работать над новым долгосрочным продуктом как разработчик.",
    "Я готова приступить к проекту по бренд-дизайну в сентябре.",
  ];
  for (const text of offerTexts) {
    const offer = classifyContractText(text);
    assert.equal(offer.type, "offer", text);
    assert.ok(offer.offerScore >= 4, text);
    assert.notEqual(offer.confidence, "low", text);
  }
});

test("recognizes explicit resume offer markers without matching isolated tags", () => {
  for (const text of [
    `#резюме #помогу

Frontend-разработчик с коммерческим опытом. Интересуют вакансии и проектная работа.
Требования к проектам: понятные задачи и своевременная оплата.`,
    `#Помогу
#Резюме

Дизайнер интерфейсов. Беру на себя исследования, прототипы и дизайн-системы.`,
  ]) {
    const classification = classifyContractText(text);

    assert.equal(classification.type, "offer", text);
    assert.equal(classification.confidence, "high", text);
    assert.ok(
      classification.evidence.includes(
        "offer: явная метка резюме и предложения помощи",
      ),
      text,
    );
  }

  assert.notEqual(
    classifyContractText(
      "Разместить #резюме можно через администратора. Помогу оформить публикацию.",
    ).type,
    "offer",
  );
  assert.equal(
    classifyContractText("#помогу\n\nИщем дизайнера для нового проекта.").type,
    "order",
  );
});

test("does not treat portfolio, experience, or bare readiness as an offer", () => {
  for (const text of [
    "Портфолио доступно по ссылке. Опыт работы пять лет.",
    "Готов работать с большим объёмом задач и соблюдать дедлайны.",
    "Нам нужен тимлид, который готов работать руками. Опыт работы от трёх лет.",
    "Кандидатка, которая готова приступить после собеседования.",
  ]) {
    assert.notEqual(classifyContractText(text).type, "offer", text);
  }
});

test("recognizes vacancy structure without relying on portfolio or experience", () => {
  const orderTexts = [
    "Что предстоит делать: разрабатывать интерфейсы и проводить код-ревью.",
    "Что нужно делать: готовить иллюстрации для новых материалов.",
    "Кого ищут: редактора с опытом в технологических продуктах.",
    "Требования: уверенное знание TypeScript и React.",
    "Мы ожидаем самостоятельность и ответственность за результат.",
    "Обязанности: вести контент-план и анализировать метрики.",
    "Кандидат должен знать SQL. З/П: 150 000 рублей.",
  ];
  for (const text of orderTexts) {
    assert.equal(classifyContractText(text).type, "order", text);
  }
});

test("regresses collected false offer classifications", () => {
  const falseOfferCases = [
    {
      url: "https://t.me/job_pythonz/644",
      expected: "order",
      text: `Ростелеком — MLE
Опыт работы: от 2 лет
Что предстоит делать: разработка ML-бэкендов
Наши пожелания к кандидатам: знание Python`,
    },
    {
      url: "https://t.me/rueventjob/18342",
      expected: "order",
      text: `Требуется TeamLead SMM. Нам нужен специалист, который готов работать руками.
Что предстоит делать: управлять контент-процессами. Портфолио обязательно.`,
    },
    {
      url: "https://t.me/dddwork/5103",
      expected: "order",
      text: `SMM Manager в бренд одежды
Кого ищут: специалиста с опытом работы от года и портфолио.
Что делать: вести контент-план и аналитику.`,
    },
    {
      url: "https://t.me/yuniorapp/4915",
      expected: "unknown",
      text: `Почему аналитики так востребованы? Бесплатный урок покажет путь к первой работе.
Вы узнаете, что должно быть в портфолио кандидата.`,
    },
    {
      url: "https://t.me/it_vakansii_jobs/3134",
      expected: "unknown",
      text: "Чеклист: 50 ошибок в портфолио дизайнеров. Актуально для рынка.",
    },
    {
      url: "https://t.me/it_vakansii_jobs/3149",
      expected: "unknown",
      text: "Сервис проанализирует ваше резюме, будет присылать вакансии и подготовит отклик.",
    },
    {
      url: "https://t.me/it_vakansii_jobs/3122",
      expected: "unknown",
      text: "Подборка 10 телеграм каналов с вакансиями за рубежом.",
    },
  ] as const;

  for (const { url, expected, text } of falseOfferCases) {
    assert.equal(classifyContractText(text).type, expected, url);
  }
});

test("keeps real work requests despite course or training vocabulary", () => {
  assert.equal(
    classifyContractText(
      "Ищем преподавателя для курса. Требования: опыт обучения взрослых.",
    ).type,
    "order",
  );
  assert.equal(
    classifyContractText("Предлагаю услуги по обучению команды работе с Figma.").type,
    "offer",
  );
});

test("recognizes an explicit first-person portfolio profile as an offer", () => {
  const text = `Монтажёр | CapCut | 2 года опыта

Привет! Видеомонтажёр с 2-летним опытом работы с короткими роликами.
Сам веду Instagram-блог и регулярно монтирую Reels.

Почему я:
— понимаю динамику коротких видео;
— соблюдаю сроки и умею работать по референсам.

Пиши в личку — покажу работы и обсудим твой проект.`;
  const classification = classifyContractText(text);

  assert.equal(classification.type, "offer");
  assert.ok(classification.offerScore >= 4);
  assert.ok(
    classification.evidence.includes("offer: явная самопрезентация исполнителя"),
  );
});

test("builds an eligible dry-run Favor payload without publishing or leaking contacts", () => {
  const source = parseTelegramChannelPage(
    telegramPage(
      telegramPostHtml({
        id: 102,
        datetime: "2026-08-24T11:30:00Z",
        username: authorHandle,
      }),
    ),
    channelHandle,
  ).posts[0];
  const normalized = normalizeScoutedPost(source, parsedConfig(), [advertisingHandle]);

  assert.equal(normalized.eligibility.eligible, true);
  assert.equal(normalized.eligibility.reviewEligible, true);
  assert.equal(normalized.eligibility.favorPayloadReady, true);
  assert.equal(normalized.contacts.selectedUsername, authorHandle);
  assert.equal(normalized.classification.type, "order");
  assert.equal(normalized.favorDryRunPayload?.isScouting, true);
  assert.equal(normalized.favorDryRunPayload?.isEscrow, false);
  assert.equal(normalized.favorDryRunPayload?.type, "order");
  assert.equal(normalized.favorDryRunPayload?.maxOpenDeals, 1);
  assert.equal(normalized.favorDryRunPayload?.category, "dev.web");
  assert.doesNotMatch(normalized.cleaned.publicText, new RegExp(authorHandle, "u"));
  assert.equal(
    normalized.favorDryRunPayload?.cachedTelegramText,
    normalized.cleaned.publicText,
  );
});

test("never maps salary, trial-task payment, or revenue into basePrice", () => {
  const cases = [
    [
      "https://t.me/talentedpeoples/33788",
      "Требуется редактор международного проекта\nНужно готовить статьи и согласовывать материалы с командой. Зарплата $500 в месяц, задачи и график обсуждаются на встрече.",
    ],
    [
      "https://t.me/designhunters/7589",
      "Ищем видеомонтажера в команду\nНужно монтировать короткие ролики по готовым сценариям. Тестовое видео оплачивается по $70, далее предусмотрена месячная зарплата.",
    ],
    [
      "https://t.me/yuniorapp/4855",
      "Требуется маркетолог для развития продукта\nНужно запускать рекламные кампании и анализировать результат. Компания достигла $2млн выручки. Обязанности и условия указаны ниже.",
    ],
  ] as const;

  for (const [url, text] of cases) {
    const post = normalizeScoutedPost(
      makeParsedPost({
        id: 211,
        datetime: "2026-08-20T00:00:00.000Z",
        username: authorHandle,
        text,
      }),
      parsedConfig(),
    );
    assert.equal(post.eligibility.favorPayloadReady, true, url);
    assert.equal(post.favorDryRunPayload?.basePrice, null, url);
  }
});

test("excludes configured channel contacts from candidate authors", () => {
  const source = parseTelegramChannelPage(
    telegramPage(
      telegramPostHtml({
        id: 103,
        datetime: "2026-08-24T12:30:00Z",
        username: advertisingHandle,
      }),
    ),
    channelHandle,
  ).posts[0];
  const normalized = normalizeScoutedPost(source, parsedConfig(), [advertisingHandle]);

  assert.equal(normalized.eligibility.eligible, false);
  assert.deepEqual(normalized.eligibility.reasons, ["no_direct_author_contact"]);
  assert.deepEqual(normalized.eligibility.favorPayloadReasons, ["review_not_eligible"]);
  assert.equal(normalized.contacts.direct.length, 0);
  assert.equal(normalized.contacts.excluded[0].username, advertisingHandle);
  assert.equal(normalized.favorDryRunPayload, null);
});

const makeParsedPost = (input: {
  id: number;
  datetime: string;
  username: string;
  text: string;
}): ParsedTelegramPost => ({
  channelHandle,
  channelUrl: `https://t.me/${channelHandle}`,
  postId: input.id,
  postUrl: `https://t.me/${channelHandle}/${input.id}`,
  publishedAt: input.datetime,
  rawText: input.text,
  inlineLinks: [],
  buttons: [],
  contacts: [
    {
      type: "telegram",
      value: input.username,
      username: input.username,
      sources: ["text"],
      evidence: [`@${input.username}`],
    },
  ],
});

test("does not treat a Telegram application bot as a direct author", () => {
  const post = normalizeScoutedPost(
    makeParsedPost({
      id: 208,
      datetime: "2026-08-20T00:00:00.000Z",
      username: "company_hiring_bot",
      text: `Требуется дизайнер интерфейсов

Нужно подготовить макеты мобильного приложения и поддерживать дизайн-систему.`,
    }),
    parsedConfig(),
  );

  assert.equal(post.contacts.direct.length, 0);
  assert.equal(post.contacts.excluded[0]?.username, "company_hiring_bot");
  assert.equal(post.eligibility.reviewEligible, false);
  assert.ok(post.eligibility.reviewReasons.includes("no_direct_author_contact"));
  assert.equal(post.favorDryRunPayload, null);
});

test("keeps the portfolio author while excluding channel footer identities", () => {
  const post = makeParsedPost({
    id: 207,
    datetime: "2026-08-20T00:00:00.000Z",
    username: "mish0nnn",
    text: `Монтажёр | CapCut | 2 года опыта

Привет! Видеомонтажёр с 2-летним опытом.
Сам веду Instagram-блог и монтирую короткие видео.
Почему я: понимаю динамику роликов и соблюдаю сроки.
Пиши в личку — покажу работы и обсудим твой проект.

========
Мир Фриланса в МАХ 🇷🇺
➖➖➖➖➖➖
Джунам / Удалёнка / За рубежом`,
  });
  post.inlineLinks = [
    {
      text: "Мир Фриланса в МАХ 🇷🇺",
      url: "https://t.me/mirfri_max",
    },
    {
      text: "Джунам / Удалёнка / За рубежом",
      url: "https://t.me/mirfri_jobs",
    },
  ];
  post.contacts.push(
    {
      type: "telegram",
      value: "mirfri",
      username: "mirfri",
      sources: ["text"],
      evidence: ["@mirfri"],
    },
    {
      type: "telegram",
      value: "reklamamirfri",
      username: "reklamamirfri",
      sources: ["text"],
      evidence: ["@reklamamirfri"],
    },
  );

  const normalized = normalizeScoutedPost(post, parsedConfig(), [
    "@mirfri",
    "@reklamamirfri",
  ]);

  assert.equal(normalized.classification.type, "offer");
  assert.equal(normalized.contacts.selectedUsername, "mish0nnn");
  assert.deepEqual(
    normalized.contacts.direct.map((contact) => contact.value),
    ["mish0nnn"],
  );
  assert.deepEqual(
    normalized.contacts.excluded.map((contact) => contact.value).sort(),
    ["mirfri", "reklamamirfri"],
  );
  assert.equal(normalized.eligibility.favorPayloadReady, true);
  assert.match(normalized.cleaned.publicText, /^Монтажёр \| CapCut/iu);
  assert.doesNotMatch(normalized.cleaned.publicText, /личк|обсудим твой проект/iu);
  assert.doesNotMatch(
    normalized.cleaned.publicText,
    /Мир Фриланса|Джунам|За рубежом|={3,}|➖{3,}/iu,
  );
  assert.equal(
    normalized.cleaned.cachedTelegramText,
    normalized.cleaned.publicText,
  );
});

test("keeps ordinary linked company text while removing real contact anchors", () => {
  const companySource = makeParsedPost({
    id: 209,
    datetime: "2026-08-20T00:00:00.000Z",
    username: authorHandle,
    text: `#whois #дизайнер #вакансия

Ищут продуктового дизайнера

Подробнее:
Мы, Portals — маркетплейс цифровых продуктов и игр.
Требуется дизайнер для развития интерфейсов продукта.`,
  });
  companySource.inlineLinks = [
    { text: "Portals", url: "https://portals.example.invalid/about" },
  ];
  const companyPost = normalizeScoutedPost(companySource, parsedConfig());

  assert.match(companyPost.cleaned.publicText, /Мы, Portals — маркетплейс/u);

  const domainCompanySource = makeParsedPost({
    id: 213,
    datetime: "2026-08-20T00:00:00.000Z",
    username: authorHandle,
    text: `GameGears.Online

Требуется дизайнер интерфейсов для игровой продуктовой команды.`,
  });
  const domainCompanyPost = normalizeScoutedPost(
    domainCompanySource,
    parsedConfig(),
  );
  assert.match(domainCompanyPost.cleaned.publicText, /GameGears\.Online/u);
  assert.equal(domainCompanyPost.eligibility.favorPayloadReady, false);
  assert.ok(
    domainCompanyPost.eligibility.favorPayloadReasons.includes(
      "title_requires_manual_review",
    ),
  );

  const contactSource = makeParsedPost({
    id: 210,
    datetime: "2026-08-20T00:00:00.000Z",
    username: authorHandle,
    text: `Требуется продуктовый дизайнер

Нужно развивать интерфейсы маркетплейса и дизайн-систему.

Заполнить форму`,
  });
  contactSource.inlineLinks = [
    { text: "Заполнить форму", url: "https://jobs.example.invalid/apply/210" },
  ];
  const contactPost = normalizeScoutedPost(contactSource, parsedConfig());

  assert.doesNotMatch(contactPost.cleaned.publicText, /заполнить форму/iu);
  assert.match(contactPost.cleaned.publicText, /развивать интерфейсы/u);
});

test("keeps application URLs private while preserving ordinary company links", () => {
  const applicationUrls = [
    "https://remocate.app/jobs/frontend-engineer",
    "https://hirify.me/jobs/backend-engineer",
    "https://hh.ru/vacancy/136062996",
    "https://duga.agency/jobs/accountmanager",
    "https://example.invalid/careers/product-designer",
    "https://example.invalid/apply",
  ];
  for (const url of applicationUrls) {
    const contacts = extractScoutingContacts({
      text: `Подробности опубликованы здесь: ${url}`,
      inlineLinks: [],
      buttons: [],
    });
    assert.deepEqual(
      contacts.filter((contact) => contact.type === "url").map((contact) => contact.value),
      [url],
      url,
    );
  }

  const ordinaryText = `Демо: https://youtube.com/watch?v=example
Приложение: https://apps.apple.com/app/id123456
О компании: https://duga.agency/about`;
  assert.equal(
    extractScoutingContacts({
      text: ordinaryText,
      inlineLinks: [],
      buttons: [],
    }).some((contact) => contact.type === "url"),
    false,
  );

  const rawText = `Требуется аккаунт-менеджер

Нужно вести клиентов агентства и координировать рабочую команду.
О компании: https://duga.agency/about
Ссылка на вакансию: https://duga.agency/jobs/accountmanager
hh.ru/vacancy/136062996`;
  const applicationContacts = extractScoutingContacts({
    text: rawText,
    inlineLinks: [],
    buttons: [],
  });
  const source = makeParsedPost({
    id: 216,
    datetime: "2026-08-20T00:00:00.000Z",
    username: authorHandle,
    text: rawText,
  });
  source.contacts.push(...applicationContacts);
  const normalized = normalizeScoutedPost(source, parsedConfig());

  assert.equal(normalized.contacts.selectedUsername, authorHandle);
  assert.deepEqual(
    normalized.contacts.direct
      .filter((contact) => contact.type === "url")
      .map((contact) => contact.value)
      .sort(),
    [
      "https://duga.agency/jobs/accountmanager",
      "https://hh.ru/vacancy/136062996",
    ],
  );
  assert.match(normalized.cleaned.publicText, /https:\/\/duga\.agency\/about/u);
  assert.doesNotMatch(
    normalized.cleaned.publicText,
    /duga\.agency\/jobs|hh\.ru\/vacancy/u,
  );
});

test("blocks suspicious or non-labor listings from review eligibility", () => {
  const cases = [
    [
      "https://t.me/rueventjob/18499",
      `Требуются публикаторы
Задачи:
- Просто нужно выставлять объявления на Авито
Требования:
- Ваш профиль на Авито должен быть 5-ти звездный
Условия:
- Зарплата: 500 руб. за каждое объявление.`,
    ],
    [
      "https://t.me/rueventjob/18476",
      "Требуются сотрудники для удалённой онлайн работы: задания по инструкции, можно без опыта.",
    ],
    [
      "https://t.me/talentedpeoples/33954",
      "Ищем людей для приглашения подписчиков в Telegram. Выплата после проверки.",
    ],
    [
      "https://t.me/talentedpeoples/33893",
      "Ищу исполнителей для публикации отзывов. Оплата за опубликованный отзыв.",
    ],
    [
      "https://t.me/talentedpeoples/33716",
      "Требуется помощница для участия в программе ЭКО и донорства ооцитов.",
    ],
    [
      "https://t.me/yuniorapp/4858",
      "Ищем разработчиков игры. Проект держится на энтузиазме, без фиксированной оплаты труда.",
    ],
    [
      "https://t.me/workinart/10526",
      "Опен-колл для выставки. Ищем произведения, основанные на художественной работе со временем.",
    ],
    [
      "https://t.me/freelancebay/16046",
      `Ищем таргетолога ВКонтакте для школы плавания.
Кандидат самостоятельно и бесплатно проводит анализ конкурентов, готовит медиаплан и воронку продаж.
После этого предлагается тестовая неделя, которая не оплачивается.`,
    ],
  ] as const;

  for (const [url, text] of cases) {
    const post = normalizeScoutedPost(
      makeParsedPost({
        id: 200,
        datetime: "2026-08-20T00:00:00.000Z",
        username: authorHandle,
        text,
      }),
      parsedConfig(),
    );
    assert.equal(post.eligibility.reviewEligible, false, url);
    assert.ok(
      post.eligibility.reviewReasons.includes("non_labor_or_suspicious_listing"),
      url,
    );
    assert.equal(post.favorDryRunPayload, null, url);
  }
});

test("routes digests and multiple-role posts to manual review", () => {
  const cases = [
    [
      "https://t.me/rueventjob/18488",
      `Требуются умные творческие специалисты:
1. Сценарист — написать сценарии запуска продукта.
2. Копирайтер — подготовить материалы для сайта.`,
    ],
    [
      "https://t.me/workinart/10638",
      "Медиа ищут двух новых сотрудников: PR-менеджера и копирайтера. Занятость проектная, условия обсуждаются.",
    ],
    [
      "https://t.me/uvetrovoi/9484",
      "Ищем сценариста для аватара. А также ищем креатора для переработки трендовых идей.",
    ],
  ] as const;

  for (const [url, text] of cases) {
    const post = normalizeScoutedPost(
      makeParsedPost({
        id: 201,
        datetime: "2026-08-20T00:00:00.000Z",
        username: authorHandle,
        text,
      }),
      parsedConfig(),
    );
    assert.equal(post.eligibility.reviewEligible, true, url);
    assert.equal(post.eligibility.favorPayloadReady, false, url);
    assert.ok(
      post.eligibility.favorPayloadReasons.includes(
        "multi_listing_digest_manual_review",
      ),
      url,
    );
    assert.equal(post.favorDryRunPayload, null, url);
  }
});

test("routes restricted and high-risk work to manual review without deleting it", () => {
  const cases = [
    [
      "https://t.me/rueventjob/18349",
      "Требуется HR-менеджер для работы в сфере 18+. Задачи и оплата обсуждаются.",
    ],
    [
      "https://t.me/talentedpeoples/33952",
      "Требуется онлайн-модель. Работа в прямом эфире, опыт не требуется.",
    ],
    [
      "https://t.me/talentedpeoples/33905",
      "Требуется хостес с релокацией в Китай. Условия и обязанности обсуждаются.",
    ],
    [
      "https://t.me/designbirzha/7398",
      "Ищем дизайнера в iGaming и gambling-продукт. Что нужно делать: создавать креативы.",
    ],
    [
      "https://t.me/work4writers/4073",
      "Ищем автора материалов про беттинг. Что нужно делать: писать обзоры.",
    ],
    [
      "https://t.me/yuniorapp/4871",
      "Требуется менеджер поддержки сервиса по выпуску виртуальных карт.",
    ],
    [
      "https://t.me/designbirzha/7411",
      "Нужен графический дизайнер в проект Vector ads. Задачи: готовить макеты.",
    ],
    [
      "https://t.me/rueventjob/18493",
      "Ищем людей для модерации каналов: удалять спам и ставить реакции.",
    ],
    [
      "https://t.me/talentedpeoples/33944",
      "Требуется куратор AI-данных. Обучение с нуля, опыт не обязателен.",
    ],
    [
      "https://t.me/freelancetaverna/3752",
      "Требования: опыт маркетолога. Оплата начинается после успешного прохождения тестового периода.",
    ],
    [
      "https://t.me/freelancetaverna/3704",
      "Ищут рассыльщика для холодных рассылок. Оплата — процент с клиента. Фикса на старте нет.",
    ],
    [
      "https://t.me/mirfri/2848",
      "Ищем оператора поддержки СДЭК. Опыт не обязателен, всему научим на стажировке.",
    ],
    [
      "https://t.me/it_vakansii_jobs/3148",
      "Новая вакансия: набирать просмотры на роликах в ютуб. Четкой стратегии нет, оплата от 2 000$.",
    ],
    [
      "https://t.me/freelancetaverna/3741",
      "Ищут специалиста чат-поддержки цифрового сервиса. Опыт не обязателен, оплата около 72 600 ₽.",
    ],
    [
      "https://t.me/freelancetaverna/3736",
      "Ищут маркетолога. Ищем соучастника в growth для приложения, который думает как founder.",
    ],
    [
      "https://t.me/freelancetaverna/3822",
      "Ищут таргетолога. Ищу таргетолога для цветочного магазина, есть проект, готов порекомендовать.",
    ],
    [
      "https://t.me/freelancebay/16203",
      "Что нужно делать: искать клиентов для Ybots. Оплата — 40% с каждого оплаченного заказа.",
    ],
    [
      "https://t.me/talentedpeoples/33947",
      "Требуется помощник маркетолога: управление репутацией компании и повышение рейтинга на площадках.",
    ],
    [
      "https://t.me/talentedpeoples/33663",
      "Требуются стримеры в команду. Доход включает бонусы за донаты и оплачиваемые часы.",
    ],
    [
      "https://t.me/rueventjob/18372",
      "Требуется менеджер: опыт духовных и трансформационных программ, оклад и 4–8% с каждой продажи.",
    ],
    [
      "https://t.me/freelancebay/16188",
      "Ищем креативщика-копирайтера. Опыт в high-risk нишах будет преимуществом.",
    ],
    [
      "https://t.me/freelancebay/16088",
      "Ищем сценариста в нише спортивной фармакологии и пептидов для постоянной работы.",
    ],
    [
      "https://t.me/freelancetaverna/3809",
      "Ищут маркетолога в проект из ниш Crypto, Forex, FinTech или Copy Trading. Важно, чтобы кандидат уже привлекал инвесторов.",
    ],
    [
      "https://t.me/freelancetaverna/3808",
      "Ищут Senior Game Designer для разработки слотов, механик RTP и jackpot.",
    ],
    [
      "https://t.me/freelancetaverna/3785",
      "Ищут контент-менеджера. Нужно проверять контент, сверять публикации и обновлять материалы по инструкции. Оплата 44 540 ₽ в месяц. Опыт не обязателен.",
    ],
    [
      "https://t.me/mirfri/2838",
      "Мир Фриланса в МАХ\n\nИщут контент-менеджера. Нужно проверять контент, сверять публикации и обновлять материалы по инструкции. Оплата 44 540 ₽ в месяц. Опыт не обязателен.",
    ],
    [
      "https://t.me/freelancetaverna/3712",
      "#ищу #брендбук #дизайнер\nИщут дизайнера YouTube-обложек на долгосрок\nПодробнее:\nНужен человек, который оформляет бренд-бук: цветовая гамма, шрифт и книга бренда одежды.",
    ],
    [
      "https://t.me/rueventjob/18427",
      "Ищем UGC-креаторов. Платформа Brandpay помогает микро-блогерам получать заказы от компаний. Набираем новую группу!",
    ],
    [
      "https://t.me/freelancetaverna/3706",
      "Ищут Junior Media Buyer для CS2. Нужно разбираться в скинах, трейде и кейсах, тестировать рабочие связки. Опыт в арбитраже будет преимуществом.",
    ],
    [
      "https://t.me/freelancetaverna/3730",
      "Ищут маркетолога в международную компанию в сфере affiliate marketing. Нужно развивать бренд нового направления.",
    ],
    [
      "https://t.me/freelancetaverna/3815",
      "Ищут SEO-специалиста. Задачи включают работу с поведенческими факторами и рост позиций сайта.",
    ],
    [
      "https://t.me/freelancetaverna/3707",
      "Ищем дизайнера. Тестовая обложка оплачивается, если она нас устраивает и начинаем сотрудничество.",
    ],
    [
      "https://t.me/itjobs_nocode/3770",
      "Ищем специалиста для роста числа отзывов и среднего рейтинга на G2, Capterra и Trustpilot.",
    ],
    [
      "https://t.me/freelancetaverna/3746",
      "Ищем специалиста по Авито: автозагрузка объявлений и масс-постинг по регионам.",
    ],
    [
      "https://t.me/it_vakansii_jobs/3131",
      "Нужен разработчик для парсинга фото из чужих галерей и сохранения их в каталог.",
    ],
    [
      "https://t.me/freelancetaverna/3702",
      "Ищем автора: 5–35 SEO-статей в день, нужно удалять признаки генерации текста.",
    ],
    [
      "https://t.me/freelancetaverna/3824",
      "Ищем креатора. Как проба подготовьте 1–2 готовые идеи для проекта.",
    ],
    [
      "https://t.me/freelancetaverna/3789",
      "Ищем сценариста. Для отбора пришлите 3 готовых hook для наших роликов.",
    ],
    [
      "https://t.me/freelancetaverna/3723",
      "Ищут ассистента. Подходит мамам в декрете и студентам, опыт не нужен, график полностью гибкий.",
    ],
    [
      "https://t.me/rueventjob/18211",
      "Требуется креатор. Основная задача — монтажер коротких видео и регулярное монтирование роликов.",
    ],
    [
      "https://t.me/talentedpeoples/33788",
      "Требуется #героиня. Ищем женщину, которая станет лицом нового медиапроекта о таро.",
    ],
  ] as const;

  for (const [url, text] of cases) {
    const post = normalizeScoutedPost(
      makeParsedPost({
        id: 202,
        datetime: "2026-08-20T00:00:00.000Z",
        username: authorHandle,
        text,
      }),
      parsedConfig(),
    );
    assert.equal(post.eligibility.reviewEligible, true, url);
    assert.equal(post.eligibility.favorPayloadReady, false, url);
    assert.ok(
      post.eligibility.favorPayloadReasons.includes(
        "manual_review_restricted_or_high_risk",
      ),
      url,
    );
    assert.equal(post.favorDryRunPayload, null, url);
  }
});

test("routes stale one-off dated work to manual review", () => {
  const post = normalizeScoutedPost(
    makeParsedPost({
      id: 212,
      datetime: "2026-08-12T08:00:00.000Z",
      username: authorHandle,
      text: `Запрос на разовую услугу переводчика тайского языка
Дата: 12.08 сегодня
Время: 13:00–14:00
Формат: удалённо, Zoom. Требуется опыт устного перевода.`,
    }),
    parsedConfig(),
  );

  assert.equal(post.eligibility.reviewEligible, true);
  assert.equal(post.eligibility.favorPayloadReady, false);
  assert.ok(
    post.eligibility.favorPayloadReasons.includes(
      "time_sensitive_listing_manual_review",
    ),
  );
  assert.equal(post.favorDryRunPayload, null);
});

test("routes listings with an explicit calendar deadline to manual review", () => {
  const post = normalizeScoutedPost(
    makeParsedPost({
      id: 213,
      datetime: "2026-07-29T08:00:00.000Z",
      username: authorHandle,
      text: `Ищем дизайнера презентаций
Нужно подготовить презентацию для конференции.
⏰ Сроки: до 31.07`,
    }),
    parsedConfig(),
  );

  assert.equal(post.eligibility.reviewEligible, true);
  assert.equal(post.eligibility.favorPayloadReady, false);
  assert.ok(
    post.eligibility.favorPayloadReasons.includes(
      "time_sensitive_listing_manual_review",
    ),
  );
  assert.equal(post.favorDryRunPayload, null);
});

test("routes urgent relative deadlines to manual review", () => {
  const post = normalizeScoutedPost(
    makeParsedPost({
      id: 214,
      datetime: "2026-08-10T08:00:00.000Z",
      username: authorHandle,
      text: `СРОЧНО: ищем дизайнера
Нужно подготовить первые макеты максимально быстро и включиться в ближайшие дни.`,
    }),
    parsedConfig(),
  );

  assert.equal(post.eligibility.reviewEligible, true);
  assert.equal(post.eligibility.favorPayloadReady, false);
  assert.ok(
    post.eligibility.favorPayloadReasons.includes(
      "time_sensitive_listing_manual_review",
    ),
  );
  assert.equal(post.favorDryRunPayload, null);
});

test("requires a usable title and enough detail before creating a dry-run payload", () => {
  const invalidTitleCases = [
    [
      "https://t.me/itjobs_nocode/3811",
      "#senior #москва #санктпетербург\n\nYADRO\nСистемный архитектор 1С: ERP\nЧто предстоит делать: проектировать архитектуру системы.",
    ],
    [
      "https://t.me/job_pythonz/644",
      "#middle #удаленка\n\nРостелеком\nMLE\nЧто предстоит делать: разрабатывать ML-бэкенды и микросервисы.",
    ],
    [
      "https://t.me/yuniorapp/4892",
      "Russia\n\nТребования: знание анализа данных и готовность работать с продуктовой командой.",
    ],
    [
      "https://t.me/designhunters/7551",
      "#удаленка\n\nОбязанности: создавать иконки, баннеры и рекламные материалы для игр.",
    ],
    [
      "https://t.me/products_jobs_projects/690",
      "Новая вакансия\n\nИщем продакт-менеджера для развития нового направления компании.",
    ],
    [
      "https://t.me/it_vakansii_jobs/3148",
      "🙂 Новая вакансия\n\nТребуется аналитик для развития корпоративной платформы и отчётности.",
    ],
    [
      "https://t.me/freelancebay/16203",
      "Что нужно делать:\n\nИщем редактора для подготовки материалов и ведения контент-плана.",
    ],
    [
      "https://t.me/products_jobs_projects/688",
      "Удалённо (Мир)\n\nТребуется проджект-менеджер для международной продуктовой команды.",
    ],
    [
      "https://t.me/mirkreatorovjob/1453",
      "Гибрид, офис в Москве, З/П от 250 000₽\n\nТребуется коммуникационный дизайнер в продуктовую команду.",
    ],
    [
      "https://t.me/yuniorapp/4855",
      "удаленно product fulltime\n\nИщем product-аналитика для развития пользовательских сценариев.",
    ],
    [
      "https://t.me/designhunters/7619",
      "GameGears.Online\n\nТребуется дизайнер интерфейсов для игровой продуктовой команды.",
    ],
    [
      "https://t.me/workinart/10517",
      "Петербургский аукционный дом\n\nИщем редактора каталога для описания предметов искусства.",
    ],
    [
      "https://t.me/zdemcv/6335",
      "Настоящая Статистика\n\nТребуется аналитик данных для развития внутренней отчётности.",
    ],
    [
      "https://t.me/mirfri/2852",
      "#вакансия #копирайтер\n\nИщем копирайтера для новой платформы социальной коммерции.",
    ],
    [
      "https://t.me/mirfri/2842",
      "#вакансия #копирайтер\n\nИщу копирайтера с опытом написания медицинских текстов.",
    ],
  ] as const;

  for (const [url, text] of invalidTitleCases) {
    const post = normalizeScoutedPost(
      makeParsedPost({
        id: 203,
        datetime: "2026-08-20T00:00:00.000Z",
        username: authorHandle,
        text,
      }),
      parsedConfig(),
    );
    assert.equal(post.eligibility.favorPayloadReady, false, url);
    assert.ok(
      post.eligibility.favorPayloadReasons.includes("title_requires_manual_review"),
      url,
    );
  }

  const tavernaTitleCases = [
    [
      "https://t.me/freelancetaverna/3827",
      "#whois #дизайнер #вебдизайнер #вакансия",
      "Ищут продуктового дизайнера",
    ],
    [
      "https://t.me/freelancetaverna/3826",
      "#ищу #сторисмейкер #дизайнер #монтажер",
      "Ищут монтажера",
    ],
    [
      "https://t.me/freelancetaverna/3813",
      "#ищу #smm #reels #рилсмейкер",
      "Ищут SMM-менеджера / Reels-мейкера",
    ],
  ] as const;
  for (const [url, hashtags, roleLine] of tavernaTitleCases) {
    const post = normalizeScoutedPost(
      makeParsedPost({
        id: 208,
        datetime: "2026-08-20T00:00:00.000Z",
        username: authorHandle,
        text: `${hashtags}\n\n${roleLine}\n\nПодробнее:\nТребуется специалист для регулярной проектной работы с командой. Нужно готовить материалы, согласовывать результат и соблюдать сроки.`,
      }),
      parsedConfig(),
    );
    assert.equal(post.eligibility.favorPayloadReady, true, url);
    assert.equal(post.favorDryRunPayload?.titleRu, roleLine, url);
    assert.doesNotMatch(post.favorDryRunPayload?.titleRu ?? "", /подробнее/iu, url);
  }

  const tooThin = normalizeScoutedPost(
    makeParsedPost({
      id: 204,
      datetime: "2026-08-20T00:00:00.000Z",
      username: authorHandle,
      text: "Требуется backend-разработчик. Задачи обсудим.",
    }),
    parsedConfig(),
  );
  assert.equal(tooThin.eligibility.favorPayloadReady, false);
  assert.ok(
    tooThin.eligibility.favorPayloadReasons.includes(
      "insufficient_contract_detail_manual_review",
    ),
  );

  const linkedTitleSource = makeParsedPost({
    id: 205,
    datetime: "2026-08-20T00:00:00.000Z",
    username: authorHandle,
    text: "#senior #remote\n\nЧто предстоит делать: проектировать и развивать архитектуру корпоративной платформы.",
  });
  linkedTitleSource.inlineLinks = [
    {
      text: "Системный архитектор корпоративной платформы",
      url: "https://jobs.example.invalid/vacancy/205",
    },
  ];
  const linkedTitlePost = normalizeScoutedPost(linkedTitleSource, parsedConfig());
  assert.equal(linkedTitlePost.eligibility.favorPayloadReady, true);
  assert.equal(
    linkedTitlePost.favorDryRunPayload?.titleRu,
    "Системный архитектор корпоративной платформы",
  );
});

test("prefers a specific role title over a generic aggregator heading", () => {
  const cases = [
    [
      "Ищут менеджера",
      "Менеджер по продажам IT-продукта",
      "Менеджер по продажам IT-продукта",
    ],
    [
      "Ищут ассистента",
      "Ассистент интернет-магазина (размещение товаров + администрирование) — удалённо, гибкий график",
      "Ассистент интернет-магазина (размещение товаров + администрирование)",
    ],
    [
      "Ищут дизайнера",
      "Ищу веб-дизайнера / разработчика для создания свадебного сайта",
      "Ищу веб-дизайнера / разработчика для создания свадебного сайта",
    ],
  ] as const;

  for (const [genericTitle, specificTitle, expectedTitle] of cases) {
    const post = normalizeScoutedPost(
      makeParsedPost({
        id: 215,
        datetime: "2026-08-20T00:00:00.000Z",
        username: authorHandle,
        text: `#вакансия #удалённо

${genericTitle}

Подробнее:
${specificTitle}
Нужно вести проект, согласовывать задачи с командой и отвечать за результат.`,
      }),
      parsedConfig(),
    );

    assert.equal(post.eligibility.favorPayloadReady, true, expectedTitle);
    assert.equal(post.favorDryRunPayload?.titleRu, expectedTitle);
  }
});

test("normalizes safe mechanical defects in source titles", () => {
  const cases = [
    [
      "(#Удаленка) Требуется #разработчик сайтов",
      "Требуется разработчик сайтов",
    ],
    ["(#Москва) Требуется #продюсер", "Требуется продюсер"],
    [
      "(#Удаленка) Требуется #AI_креатор/ #монтажёр",
      "Требуется AI креатор / монтажёр",
    ],
    [
      "SММ/ social marketing specialist",
      "SMM / social marketing specialist",
    ],
    [
      "Монтажёр | CapCut| 2 года опыта",
      "Монтажёр | CapCut | 2 года опыта",
    ],
    [
      "Сontent-менеджер в в бренд женской одежды ANUKA",
      "Content-менеджер в бренд женской одежды ANUKA",
    ],
    [
      "B2B- менеджер по продажам IT-продукта",
      "B2B-менеджер по продажам IT-продукта",
    ],
  ] as const;

  for (const [sourceTitle, expectedTitle] of cases) {
    const post = normalizeScoutedPost(
      makeParsedPost({
        id: 216,
        datetime: "2026-08-20T00:00:00.000Z",
        username: authorHandle,
        text: `${sourceTitle}

Ищем специалиста для регулярной проектной работы. Нужно согласовывать задачи с командой и отвечать за результат.`,
      }),
      parsedConfig(),
    );

    assert.equal(post.eligibility.favorPayloadReady, true, sourceTitle);
    assert.equal(post.favorDryRunPayload?.titleRu, expectedTitle, sourceTitle);
  }
});

test("routes a malformed source title to manual review", () => {
  const post = normalizeScoutedPost(
    makeParsedPost({
      id: 217,
      datetime: "2026-08-20T00:00:00.000Z",
      username: authorHandle,
      text: `В онлайн-школу по выпечки хлеба нужен SММ на конкретные задачи

Нужно составлять контент-план, публиковать материалы и готовить сценарии роликов.`,
    }),
    parsedConfig(),
  );

  assert.equal(post.eligibility.favorPayloadReady, false);
  assert.ok(
    post.eligibility.favorPayloadReasons.includes(
      "malformed_title_manual_review",
    ),
  );
});

test("does not derive a contract title from an application URL fragment", () => {
  const applicationUrl =
    "https://www.remocate.app/jobs/sales-manager-cleverlee";
  const source = makeParsedPost({
    id: 218,
    datetime: "2026-08-20T00:00:00.000Z",
    username: authorHandle,
    text: `Sales Manager в Cleverlee: ${applicationUrl}

Можно работать удалённо. Зарплата в евро.

При отклике укажите, что нашли вакансию на Remocate.`,
  });
  source.inlineLinks = [{ text: applicationUrl, url: applicationUrl }];

  const post = normalizeScoutedPost(source, parsedConfig());

  assert.equal(post.eligibility.favorPayloadReady, false);
  assert.deepEqual(post.eligibility.favorPayloadReasons, ["review_not_eligible"]);
  assert.doesNotMatch(post.cleaned.publicText, /Remocate|https?:/iu);
});

test("routes concise listings without enough contract scope to manual review", () => {
  const cases = [
    `Таргетолог для ТТ, условия в лс

Для проекта ищем таргетолога в Тик ток адс, Tiktok ads, гео Беларусь, Россия, если можно`,
    `Моушен дизайнер

Ищут дизайнеров уровня Middle с навыками 3D и motion design. Условия оплаты обсуждаются индивидуально`,
  ];

  for (const [index, text] of cases.entries()) {
    const post = normalizeScoutedPost(
      makeParsedPost({
        id: 219 + index,
        datetime: "2026-08-20T00:00:00.000Z",
        username: authorHandle,
        text,
      }),
      parsedConfig(),
    );

    assert.equal(post.eligibility.reviewEligible, true);
    assert.equal(post.eligibility.favorPayloadReady, false);
    assert.ok(
      post.eligibility.favorPayloadReasons.includes(
        "insufficient_contract_detail_manual_review",
      ),
    );
    assert.equal(post.favorDryRunPayload, null);
  }
});

test("does not create a payload from text ending at an unfinished section", () => {
  const post = normalizeScoutedPost(
    makeParsedPost({
      id: 206,
      datetime: "2026-08-20T00:00:00.000Z",
      username: authorHandle,
      text: `Ищем опытного AI-креатора для роликов под ключ.
Сдельно, удалённо, свободный график, регулярные задачи.
Важный момент!`,
    }),
    parsedConfig(),
  );

  assert.equal(post.eligibility.favorPayloadReady, false);
  assert.ok(
    post.eligibility.favorPayloadReasons.includes(
      "incomplete_contract_text_manual_review",
    ),
  );
  assert.equal(post.favorDryRunPayload, null);
});

test("deduplicates globally by username and cleaned content while keeping newest", () => {
  const config = parsedConfig();
  const oldByUsername = normalizeScoutedPost(
    makeParsedPost({
      id: 1,
      datetime: "2026-08-01T00:00:00.000Z",
      username: "zz_test_only_person_a",
      text: "Ищу работу. Готов взять проект по разработке сайта и обсудить задачи.",
    }),
    config,
  );
  const newByUsername = normalizeScoutedPost(
    makeParsedPost({
      id: 2,
      datetime: "2026-08-02T00:00:00.000Z",
      username: "zz_test_only_person_a",
      text: "Ищу работу. Готов разработать мобильное приложение для заказчика.",
    }),
    config,
  );
  const oldByContent = normalizeScoutedPost(
    makeParsedPost({
      id: 3,
      datetime: "2026-08-03T00:00:00.000Z",
      username: "zz_test_only_person_b",
      text: "Требуется специалист для большого проекта с понятными задачами.",
    }),
    config,
  );
  const newByContent = normalizeScoutedPost(
    makeParsedPost({
      id: 4,
      datetime: "2026-08-04T00:00:00.000Z",
      username: "zz_test_only_person_c",
      text: "Требуется специалист для большого проекта с понятными задачами!",
    }),
    config,
  );
  const makeEmailPost = (id: number, datetime: string, description: string) =>
    normalizeScoutedPost(
      {
        channelHandle,
        channelUrl: `https://t.me/${channelHandle}`,
        postId: id,
        postUrl: `https://t.me/${channelHandle}/${id}`,
        publishedAt: datetime,
        rawText: `${description}\nДля связи: duplicate@example.invalid`,
        inlineLinks: [],
        buttons: [],
        contacts: [
          {
            type: "email",
            value: "duplicate@example.invalid",
            username: null,
            sources: ["text"],
            evidence: ["Для связи: duplicate@example.invalid"],
          },
        ],
      },
      config,
    );
  const oldByEmail = makeEmailPost(
    5,
    "2026-08-05T00:00:00.000Z",
    "Требуется автор для подготовки подробных статей о технологиях.",
  );
  const newByEmail = makeEmailPost(
    6,
    "2026-08-06T00:00:00.000Z",
    "Требуется редактор для проверки материалов перед публикацией.",
  );

  const deduped = dedupeScoutedPosts([
    oldByUsername,
    newByUsername,
    oldByContent,
    newByContent,
    oldByEmail,
    newByEmail,
  ]);
  assert.deepEqual(
    deduped.map((post) => post.source.postId),
    [6, 4, 2],
  );
});

test("deduplication keeps the safest usable representative before recency", () => {
  const config = parsedConfig();
  const username = "zz_test_only_safe_person";
  const safeText = `Требуется редактор для технологического медиа

Нужно готовить подробные статьи, проверять факты, согласовывать структуру материалов и соблюдать редакционные сроки.`;
  const safe = normalizeScoutedPost(
    makeParsedPost({
      id: 301,
      datetime: "2026-08-01T00:00:00.000Z",
      username,
      text: safeText,
    }),
    config,
  );
  const newerWithoutContactSource = makeParsedPost({
    id: 302,
    datetime: "2026-08-02T00:00:00.000Z",
    username: "zz_test_only_missing_contact",
    text: safeText,
  });
  newerWithoutContactSource.contacts = [];
  const newerWithoutContact = normalizeScoutedPost(
    newerWithoutContactSource,
    config,
  );
  const newerHighRisk = normalizeScoutedPost(
    makeParsedPost({
      id: 303,
      datetime: "2026-08-03T00:00:00.000Z",
      username,
      text: `Требуется дизайнер для онлайн-казино

Нужно регулярно готовить рекламные баннеры, игровые экраны и промоматериалы для международного проекта.`,
    }),
    config,
  );

  assert.equal(safe.eligibility.favorPayloadReady, true);
  assert.equal(newerWithoutContact.eligibility.reviewEligible, false);
  assert.equal(newerHighRisk.eligibility.favorPayloadReady, false);
  assert.deepEqual(
    dedupeScoutedPosts([newerHighRisk, newerWithoutContact, safe]).map(
      (post) => post.source.postId,
    ),
    [301],
  );
});

test("deduplicates near-identical aggregator reposts across contacts", () => {
  const config = parsedConfig();
  const body = `Требуется помощник контент-менеджера для стабильной удалённой работы.

Нужно проверять публикации, собирать материалы от редакторов, готовить карточки, следить за сроками и аккуратно обновлять календарь. Важно уверенно работать с таблицами, быстро замечать ошибки, задавать уточняющие вопросы и самостоятельно доводить понятные задачи до результата. Команда предоставляет инструкции, доступы и обратную связь. График гибкий, загрузка регулярная, оплата обсуждается после знакомства.`;
  const originalSource = makeParsedPost({
    id: 214,
    datetime: "2026-08-02T00:00:00.000Z",
    username: "zz_test_only_semantic_original",
    text: body,
  });
  originalSource.channelHandle = "mirfri";
  originalSource.channelUrl = "https://t.me/mirfri";
  originalSource.postUrl = "https://t.me/mirfri/214";
  const repostSource = makeParsedPost({
    id: 215,
    datetime: "2026-08-13T00:00:00.000Z",
    username: "zz_test_only_semantic_repost",
    text: `#ищу #контент #ассистент

Ищут помощника контент-менеджера

Подробнее:
${body}`,
  });
  repostSource.channelHandle = "freelancetaverna";
  repostSource.channelUrl = "https://t.me/freelancetaverna";
  repostSource.postUrl = "https://t.me/freelancetaverna/215";

  const original = normalizeScoutedPost(originalSource, config);
  const repost = normalizeScoutedPost(repostSource, config);
  const deduped = dedupeScoutedPosts([repost, original]);

  assert.equal(deduped.length, 1);
  assert.equal(deduped[0].source.postUrl, "https://t.me/mirfri/214");
});

test("paginates public history until the rolling window boundary", async () => {
  const urls: string[] = [];
  const pages = [
    telegramPage(
      telegramPostHtml({
        id: 110,
        datetime: "2026-08-24T10:00:00Z",
        username: "zz_test_only_recent_a",
        body: "Нужно разработать интернет-магазин и настроить каталог товаров.",
      }) +
        telegramPostHtml({
          id: 109,
          datetime: "2026-08-20T10:00:00Z",
          username: "zz_test_only_recent_b",
          body: "Нужно собрать мобильное приложение и подключить уведомления.",
        }),
    ),
    telegramPage(
      telegramPostHtml({
        id: 108,
        datetime: "2026-08-02T10:00:00Z",
        username: "zz_test_only_recent_c",
        body: "Нужно спроектировать интерфейс сервиса и подготовить дизайн-систему.",
      }) +
        telegramPostHtml({
          id: 107,
          datetime: "2026-07-30T10:00:00Z",
          username: "zz_test_only_old",
          body: "Нужно написать серверную часть и документацию для интеграции.",
        }),
    ),
  ];
  const fetcher = (async (url: string | URL | Request) => {
    urls.push(String(url));
    return new Response(pages[urls.length - 1] ?? telegramPage(""), { status: 200 });
  }) as typeof fetch;
  const artifact = await collectTelegramScouting({
    channels: [parsedConfig()],
    from: new Date("2026-08-01T00:00:00Z"),
    to: new Date("2026-08-25T00:00:00Z"),
    maxPagesPerChannel: 10,
    requestDelayMs: 0,
    generatedAt: new Date("2026-08-25T01:00:00Z"),
    fetcher,
  });

  assert.equal(urls.length, 2);
  assert.match(urls[1], /before=109/u);
  assert.equal(artifact.mode, "dry-run");
  assert.equal(artifact.schemaVersion, 2);
  assert.equal(artifact.summary.scrapedPostCount, 3);
  assert.equal(artifact.summary.deduplicatedPostCount, 3);
  assert.equal(artifact.summary.contactEligiblePostCount, 3);
  assert.equal(artifact.summary.discardedNoDirectContactPostCount, 0);
  assert.equal(artifact.summary.eligiblePostCount, 3);
  assert.deepEqual(
    artifact.posts.map((post) => post.source.postId),
    [110, 109, 108],
  );
  assert.deepEqual(artifact.channels[0].outreachContacts, [
    {
      type: "telegram",
      value: advertisingHandle,
      username: advertisingHandle,
      kind: "advertising",
      context: `По рекламе: @${advertisingHandle}`,
    },
  ]);
});

test("resolves rolling and explicit inclusive date windows", () => {
  const rolling = resolveDateWindow({
    days: 30,
    now: new Date("2026-08-25T12:00:00Z"),
  });
  assert.equal(rolling.from.toISOString(), "2026-07-26T12:00:00.000Z");
  assert.equal(rolling.to.toISOString(), "2026-08-25T12:00:00.000Z");

  const explicit = resolveDateWindow({ from: "2026-08-01", to: "2026-08-10" });
  assert.equal(explicit.from.toISOString(), "2026-08-01T00:00:00.000Z");
  assert.equal(explicit.to.toISOString(), "2026-08-10T23:59:59.999Z");
  assert.throws(
    () => resolveDateWindow({ from: "2026-08-01", days: 30 }),
    /either --days or --from\/--to/u,
  );
});

test("CLI accepts collection options and rejects any publishing path", () => {
  assert.deepEqual(
    parseCliArgs([
      "--input",
      "channels.json",
      "--output=artifact.json",
      "--days",
      "30",
    ]),
    {
      input: "channels.json",
      output: "artifact.json",
      days: 30,
    },
  );
  assert.throws(
    () =>
      parseCliArgs([
        "--input",
        "channels.json",
        "--output",
        "artifact.json",
        "--publish",
      ]),
    /intentionally unsupported/u,
  );
});
