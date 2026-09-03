import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  dealNotificationCatalogs,
  getDealNotificationStatusLabel,
  renderDealNotificationMessage,
  type DealNotificationMessageKey,
} from "../../src/features/deal-notifications/messages";

const getPlaceholders = (message: string) =>
  [...message.matchAll(/\{([^{}]+)\}/g)]
    .map((match) => match[1])
    .sort();

test("deal notification catalogs keep key and placeholder parity", () => {
  const english = dealNotificationCatalogs.en;
  const russian = dealNotificationCatalogs.ru;

  assert.deepEqual(Object.keys(russian).sort(), Object.keys(english).sort());
  assert.deepEqual(
    Object.keys(russian.statuses).sort(),
    Object.keys(english.statuses).sort(),
  );

  for (const key of Object.keys(english) as Array<keyof typeof english>) {
    if (key === "statuses") continue;
    assert.deepEqual(
      getPlaceholders(russian[key]),
      getPlaceholders(english[key]),
      key,
    );
  }
});

test("deal notification controls and status labels preserve exact EN/RU copy", () => {
  const controlKeys = [
    "participantFallback",
    "openDeal",
    "contactCounterpart",
    "openMiniApp",
    "openContract",
    "deletedContract",
    "deadlineDays",
    "deadlineNotSpecified",
    "projectMaterialsCount",
    "projectMaterialsNone",
  ] as const satisfies readonly DealNotificationMessageKey[];

  const renderControls = (locale: "en" | "ru") =>
    Object.fromEntries(
      controlKeys.map((key) => [
        key,
        renderDealNotificationMessage(locale, key, {
          id: 42,
          days: 7,
          count: 2,
        }),
      ]),
    );

  assert.deepEqual(renderControls("en"), {
    participantFallback: "user #42",
    openDeal: "Open deal",
    contactCounterpart: "Contact the other party",
    openMiniApp: "Open Favor Mini App",
    openContract: "Open contract",
    deletedContract: "Deleted contract",
    deadlineDays: "7 days",
    deadlineNotSpecified: "Not specified",
    projectMaterialsCount: "2 — open in the deal",
    projectMaterialsNone: "None added",
  });
  assert.deepEqual(renderControls("ru"), {
    participantFallback: "пользователь #42",
    openDeal: "Открыть сделку",
    contactCounterpart: "Связаться со второй стороной",
    openMiniApp: "Открыть миниапп Favor",
    openContract: "Открыть контракт",
    deletedContract: "Контракт удален",
    deadlineDays: "7 дн.",
    deadlineNotSpecified: "Не указан",
    projectMaterialsCount: "2 — открыть в сделке",
    projectMaterialsNone: "Не добавлены",
  });

  assert.equal(getDealNotificationStatusLabel("en", "in_progress"), "In progress");
  assert.equal(getDealNotificationStatusLabel("ru", "in_progress"), "В работе");
  assert.equal(
    getDealNotificationStatusLabel("en", "revision_requested"),
    "Revision requested",
  );
  assert.equal(
    getDealNotificationStatusLabel("ru", "revision_requested"),
    "Запрошена доработка",
  );
});

test("deal notification templates preserve exact rendered EN/RU output", () => {
  const values = {
    dealId: 42,
    contractTitle: "Brand kit",
    counterpart: "@counterpart",
    customer: "@customer",
    actor: "@actor",
    previousStatus: "Awaiting approval",
    nextStatus: "In progress",
    details: "Prepare assets",
    price: "2500",
    deadline: "7 days",
    materials: "2 — open in the deal",
    dealInfo: "Offer: Brand kit\nTerms: Prepare assets\nPrice: 2500\nDeadline: 7 days\nProject materials: 2 — open in the deal",
    hoursLeft: 2,
  };

  const render = (locale: "en" | "ru", key: DealNotificationMessageKey) =>
    renderDealNotificationMessage(locale, key, values);

  assert.deepEqual(
    {
      dealInfo: render("en", "dealInfo"),
      dealCreatedCustomer: render("en", "dealCreatedCustomer"),
      dealCreatedFreelancer: render("en", "dealCreatedFreelancer"),
      escrowFundedFreelancer: render("en", "escrowFundedFreelancer"),
      escrowFundedCustomer: render("en", "escrowFundedCustomer"),
      statusChanged: render("en", "statusChanged"),
      dealCompleted: render("en", "dealCompleted"),
      reviewSaved: render("en", "reviewSaved"),
      paymentExpiring: render("en", "paymentExpiring"),
      paymentExpired: render("en", "paymentExpired"),
      deadlineApproaching: render("en", "deadlineApproaching"),
      overdueFreelancer: render("en", "overdueFreelancer"),
      overdueEscrowCustomer: render("en", "overdueEscrowCustomer"),
      overdueLegacyEscrowCustomer: render("en", "overdueLegacyEscrowCustomer"),
      overdueDirectCustomer: render("en", "overdueDirectCustomer"),
    },
    {
      dealInfo:
        "Offer: Brand kit\nTerms: Prepare assets\nPrice: 2500\nDeadline: 7 days\nProject materials: 2 — open in the deal",
      dealCreatedCustomer:
        "Deal #42 for contract \"Brand kit\" was created.\n\nOther party: @counterpart.\n\nRequest details:\nOffer: Brand kit\nTerms: Prepare assets\nPrice: 2500\nDeadline: 7 days\nProject materials: 2 — open in the deal\n\nYou communicate directly in Telegram, while Favor Bot sends service notifications for each deal stage.",
      dealCreatedFreelancer:
        "New deal request for contract \"Brand kit\".\n\nDeal #42 was created. Other party: @counterpart.\n\nRequest details:\nOffer: Brand kit\nTerms: Prepare assets\nPrice: 2500\nDeadline: 7 days\nProject materials: 2 — open in the deal\n\nOpen the deal in Favor and use the button below to contact the other party.",
      escrowFundedFreelancer:
        "@customer funded Escrow. Deal #42 is now In progress.\n\nContract: \"Brand kit\"\n\n⚠️ Important: attach work-in-progress and final deliverables (files, archives, and documents) directly in this bot chat. Independent moderators can use them as evidence if the customer refuses to accept the work.",
      escrowFundedCustomer:
        "Funds were locked in the Escrow smart contract. Deal #42 is now In progress.\n\nContract: \"Brand kit\"\n\nThe freelancer has started working. Wait for the deliverables and completion notification.",
      statusChanged:
        "@actor changed the status of deal #42.\n\nPrevious: Awaiting approval\nNew: In progress\n\nContract: \"Brand kit\"",
      dealCompleted:
        "Deal #42 is complete.\n\nBoth parties left final reviews for contract \"Brand kit\".",
      reviewSaved:
        "@actor left a review for deal #42.\n\nYou can now finish the deal and leave your final review.",
      paymentExpiring:
        "⏰ Payment reminder for deal #42.\n\nThe payment window for contract \"Brand kit\" expires in approximately 2 hours.\nPlease fund the Escrow contract or confirm payment to avoid deal cancellation.",
      paymentExpired:
        "❌ Deal #42 was cancelled due to payment expiration.\n\nContract: \"Brand kit\"\n\nThe 24-hour payment window passed without confirmation. You can re-open or initiate a new deal via the contract link below.",
      deadlineApproaching:
        "⏳ Execution deadline approaching for deal #42.\n\nContract: \"Brand kit\"\nApproximately 2 hours remaining to submit deliverables.",
      overdueFreelancer:
        "⚠️ Deal #42 is overdue.\n\nContract: \"Brand kit\"\nThe planned deadline has passed. Please upload your work or communicate with the customer.",
      overdueEscrowCustomer:
        "⏰ The delivery deadline for deal #42 has passed.\n\nContract: \"Brand kit\"\nYour tokens remain locked in Escrow. Open the deal and choose “Return funds” to reclaim 100% of the amount.",
      overdueLegacyEscrowCustomer:
        "⏰ The delivery deadline for deal #42 has passed.\n\nContract: \"Brand kit\"\nYour tokens remain locked in Escrow. Open the deal to request a 100% refund through Favor arbitration.",
      overdueDirectCustomer:
        "⚠️ Deal #42 is overdue.\n\nContract: \"Brand kit\"\nThe contractor has missed the agreed deadline. Contact them or open a dispute from the deal.",
    },
  );

  const russianValues = {
    ...values,
    previousStatus: "Ожидает подтверждения",
    nextStatus: "В работе",
    deadline: "7 дн.",
    materials: "2 — открыть в сделке",
    dealInfo:
      "Тип предложения: Brand kit\nУсловия: Prepare assets\nЦена: 2500\nСрок: 7 дн.\nМатериалы проекта: 2 — открыть в сделке",
  };
  const renderRussian = (key: DealNotificationMessageKey) =>
    renderDealNotificationMessage("ru", key, russianValues);

  assert.deepEqual(
    {
      dealInfo: renderRussian("dealInfo"),
      dealCreatedCustomer: renderRussian("dealCreatedCustomer"),
      dealCreatedFreelancer: renderRussian("dealCreatedFreelancer"),
      escrowFundedFreelancer: renderRussian("escrowFundedFreelancer"),
      escrowFundedCustomer: renderRussian("escrowFundedCustomer"),
      statusChanged: renderRussian("statusChanged"),
      dealCompleted: renderRussian("dealCompleted"),
      reviewSaved: renderRussian("reviewSaved"),
      paymentExpiring: renderRussian("paymentExpiring"),
      paymentExpired: renderRussian("paymentExpired"),
      deadlineApproaching: renderRussian("deadlineApproaching"),
      overdueFreelancer: renderRussian("overdueFreelancer"),
      overdueEscrowCustomer: renderRussian("overdueEscrowCustomer"),
      overdueLegacyEscrowCustomer: renderRussian("overdueLegacyEscrowCustomer"),
      overdueDirectCustomer: renderRussian("overdueDirectCustomer"),
    },
    {
      dealInfo:
        "Тип предложения: Brand kit\nУсловия: Prepare assets\nЦена: 2500\nСрок: 7 дн.\nМатериалы проекта: 2 — открыть в сделке",
      dealCreatedCustomer:
        "Сделка #42 по контракту \"Brand kit\" создана.\n\nВторая сторона: @counterpart.\n\nДетали заявки:\nТип предложения: Brand kit\nУсловия: Prepare assets\nЦена: 2500\nСрок: 7 дн.\nМатериалы проекта: 2 — открыть в сделке\n\nОбщение проходит напрямую между вами в Telegram, а Favor-бот будет присылать сервисные уведомления по этапам сделки.",
      dealCreatedFreelancer:
        "Новая заявка на сделку по контракту \"Brand kit\".\n\nСделка #42 создана. Вторая сторона: @counterpart.\n\nДетали заявки:\nТип предложения: Brand kit\nУсловия: Prepare assets\nЦена: 2500\nСрок: 7 дн.\nМатериалы проекта: 2 — открыть в сделке\n\nОткройте сделку в Favor и перейдите в чат со второй стороной по кнопке ниже.",
      escrowFundedFreelancer:
        "@customer внес средства в Escrow. Сделка #42 перешла в статус \"В работе\".\n\nКонтракт: \"Brand kit\"\n\n⚠️ Важно: прикрепляйте промежуточные и итоговые результаты работы (файлы, архивы, документы) прямо в этот чат с ботом. Это позволит независимым модераторам справедливо решить спор в вашу пользу, если заказчик по какой-то причине откажется принимать работу.",
      escrowFundedCustomer:
        "Средства успешно заблокированы в Escrow смарт-контракте. Сделка #42 перешла в статус \"В работе\".\n\nКонтракт: \"Brand kit\"\n\nИсполнитель приступил к выполнению задачи. Ожидайте загрузки результатов и уведомления о готовности.",
      statusChanged:
        "@actor изменил статус сделки #42.\n\nБыло: Ожидает подтверждения\nСтало: В работе\n\nКонтракт: \"Brand kit\"",
      dealCompleted:
        "Сделка #42 завершена.\n\nОбе стороны оставили финальные отзывы по контракту \"Brand kit\".",
      reviewSaved:
        "@actor оставил отзыв по сделке #42.\n\nТеперь вы можете завершить сопровождение сделки и оставить свой финальный отзыв.",
      paymentExpiring:
        "⏰ Напоминание об оплате по сделке #42.\n\nСрок на оплату сделки по контракту \"Brand kit\" истекает примерно через 2 ч.\nПожалуйста, внесите средства в Escrow или подтвердите оплату, чтобы сделка не была автоматически отменена.",
      paymentExpired:
        "❌ Сделка #42 отменена в связи с истечением срока на оплату.\n\nКонтракт: \"Brand kit\"\n\nОтведенный 24-часовой срок на оплату истек. Вы можете открыть новую сделку по контракту по кнопке ниже.",
      deadlineApproaching:
        "⏳ Приближается дедлайн выполнения по сделке #42.\n\nКонтракт: \"Brand kit\"\nОсталось примерно 2 ч. для загрузки результатов работы.",
      overdueFreelancer:
        "⚠️ Сделка #42 просрочена.\n\nКонтракт: \"Brand kit\"\nЗапланированный срок выполнения истек. Пожалуйста, прикрепите результаты работы или свяжитесь с заказчиком.",
      overdueEscrowCustomer:
        "⏰ Срок выполнения сделки #42 истёк.\n\nКонтракт: \"Brand kit\"\nВаши токены остаются заблокированы в Escrow. Откройте сделку и выберите «Вернуть средства», чтобы получить 100% суммы обратно.",
      overdueLegacyEscrowCustomer:
        "⏰ Срок выполнения сделки #42 истёк.\n\nКонтракт: \"Brand kit\"\nВаши токены остаются заблокированы в Escrow. Откройте сделку, чтобы запросить 100% возврат через арбитраж Favor.",
      overdueDirectCustomer:
        "⚠️ Сделка #42 просрочена.\n\nКонтракт: \"Brand kit\"\nИсполнитель превысил согласованный срок. Свяжитесь с ним или откройте спор по сделке.",
    },
  );
});

test("deal notification interpolation does not reinterpret user-provided placeholders", () => {
  assert.equal(
    renderDealNotificationMessage("en", "dealInfo", {
      contractTitle: "Use {details} literally",
      details: "Keep {price} untouched",
      price: "100",
      deadline: "Tomorrow",
      materials: "None added",
    }),
    "Offer: Use {details} literally\nTerms: Keep {price} untouched\nPrice: 100\nDeadline: Tomorrow\nProject materials: None added",
  );
});

test("deal notification server and deal presentation contain no Cyrillic fallback copy", async () => {
  const sourcePaths = [
    "../../src/features/deal-notifications/server.ts",
    "../../src/features/deal-notifications/messages.ts",
    "../../src/entities/deal/model/presentation.ts",
  ];

  for (const relativePath of sourcePaths) {
    const source = await readFile(
      fileURLToPath(new URL(relativePath, import.meta.url)),
      "utf8",
    );
    assert.doesNotMatch(source, /[А-Яа-яЁё]/u, relativePath);
  }
});
