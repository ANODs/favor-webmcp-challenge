import assert from "node:assert/strict";
import test from "node:test";

import { classifyContractCategory } from "../../src/entities/category/model/classifier";

test("classifier merges video editor wording in Russian and English", () => {
  const cases = [
    { titleRu: "Ищем видеомонтажёра для Reels" },
    { titleRu: "Редактор видео для YouTube" },
    { titleEn: "Video editor for TikTok Shorts" },
    { titleEn: "Reels editor for a creator" },
  ];

  for (const input of cases) {
    const result = classifyContractCategory(input);
    assert.equal(result.categoryId, "media.video_editing", JSON.stringify(input));
    assert.equal(result.confidence, "high", JSON.stringify(input));
    assert.ok(result.score > 0);
    assert.ok(result.evidence.length > 0);
  }
});

test("title context outweighs an adjacent discipline in the description", () => {
  const result = classifyContractCategory({
    titleRu: "Видеомонтажёр для коротких роликов",
    descriptionRu: "Работа вместе с SMM-менеджером: ведение соцсетей и контент-план.",
  });

  assert.equal(result.categoryId, "media.video_editing");
  assert.equal(result.confidence, "high");
});

test("specific website context outweighs a generic developer role", () => {
  const oneField = classifyContractCategory({
    titleRu: "Требуется разработчик / Нужно разработать сайт",
  });
  const splitFields = classifyContractCategory({
    titleRu: "Требуется разработчик",
    descriptionRu: "Нужно разработать сайт компании под ключ.",
  });

  assert.equal(oneField.categoryId, "dev.web");
  assert.equal(oneField.confidence, "high");
  assert.equal(splitFields.categoryId, "dev.web");
  assert.notEqual(splitFields.confidence, "low");
});

test("classifier distinguishes nearby roles by context", () => {
  assert.equal(
    classifyContractCategory({ titleRu: "Видеограф на съёмку рекламного ролика" }).categoryId,
    "media.video_production",
  );
  assert.equal(
    classifyContractCategory({ titleRu: "Веб-дизайнер лендингов" }).categoryId,
    "design.web",
  );
  assert.equal(
    classifyContractCategory({ titleEn: "Frontend React developer" }).categoryId,
    "dev.frontend",
  );
  assert.equal(
    classifyContractCategory({ titleRu: "Аккаунт-менеджер digital-агентства" }).categoryId,
    "business.account",
  );
  assert.equal(
    classifyContractCategory({ titleRu: "Бухгалтер на удалённую работу" }).categoryId,
    "finance.accounting",
  );
  assert.equal(
    classifyContractCategory({ titleRu: "Менеджер маркетплейсов Ozon и Wildberries" }).categoryId,
    "commerce.marketplaces",
  );
});

test("classifier covers frequent role wording from the scouting corpus", () => {
  const cases = [
    ["Product designer", "design.uiux"],
    ["Продуктовый дизайнер", "design.uiux"],
    ["3D Generalist", "design.3d"],
    ["3D-дизайнер", "design.3d"],
    ["контент-менеджер", "marketing.content"],
    ["content moderator", "marketing.content"],
    ["креативный продюсер", "marketing.content"],
    ["корпоративный блогер", "marketing.content"],
    ["оператор чата", "business.support"],
    ["чат-менеджер", "business.support"],
    ["оператор ввода данных", "business.assistant"],
    ["оператор внутренней платформы", "business.assistant"],
    ["дизайнер эмодзи", "design.graphic"],
    ["кинопродюсер", "media.video_production"],
    ["специалист по свету", "business.events"],
    ["рекламный менеджер", "marketing.ads"],
    ["менеджер по закупкам", "business.operations"],
    ["приём и хранение", "business.operations"],
    ["Актриса для вертикального Reels-сериала", "media.performance"],
    ["Ищем модель для съёмки рекламы", "media.performance"],
    ["Ведущий блога", "media.performance"],
    ["Ведущий мероприятия", "media.performance"],
    ["on-camera host", "media.performance"],
    ["presenter", "media.performance"],
    ["ввод данных", "business.assistant"],
    ["декоратор", "design.product"],
  ] as const;

  for (const [titleRu, categoryId] of cases) {
    const result = classifyContractCategory({ titleRu });
    assert.equal(result.categoryId, categoryId, titleRu);
    assert.notEqual(result.confidence, "low", titleRu);
  }
});

test("performance model wording does not capture product or data models", () => {
  const cases = [
    "Product data model architect",
    "Модель данных для продукта",
    "LLM model fine-tuning",
    "3D model artist",
  ];

  for (const titleEn of cases) {
    assert.notEqual(
      classifyContractCategory({ titleEn }).categoryId,
      "media.performance",
      titleEn,
    );
  }
});

test("production other.manual contexts resolve through reusable taxonomy signals", () => {
  const cases = [
    {
      name: "dedicated TikTok music promotion",
      input: { titleRu: "TikTok-промо трека у блогеров" },
      expected: "marketing.tiktok_promo",
    },
    {
      name: "on-camera facial performance",
      input: {
        titleRu: "Требуются творческие люди",
        descriptionRu:
          "Нужно снять короткие видео перед камерой: эмоции, фразы, мимика и лицо для Reels.",
      },
      expected: "media.performance",
    },
    {
      name: "Yandex Direct tags",
      input: { tags: ["яндексдирект", "контекстнаяреклама"] },
      expected: "marketing.ads",
    },
    {
      name: "corporate learning operations",
      input: {
        titleRu: "Стажёр по внешнему обучению",
        descriptionRu: "Создаём корпоративные образовательные программы и работаем с учебными центрами.",
      },
      expected: "education.training",
    },
    {
      name: "educational camp counselor",
      input: { titleRu: "Вожатый в детский образовательный лагерь" },
      expected: "education.training",
    },
    {
      name: "theatre stagehand",
      input: {
        titleRu: "Сценический монтировщик в театр",
        descriptionRu: "Монтаж и демонтаж декораций перед спектаклем.",
      },
      expected: "business.events",
    },
    {
      name: "event equipment pedestal",
      input: { titleRu: "Аренда пьедесталов и оборудования для мероприятия" },
      expected: "business.events",
    },
    {
      name: "client and partner development",
      input: {
        titleRu: "Менеджер по привлечению и развитию клиентов",
        descriptionRu: "Привлекать новых участников и коммерческих партнёров.",
      },
      expected: "business.development",
    },
    {
      name: "HR manager",
      input: { titleRu: "HR-менеджер по поиску и найму кандидатов" },
      expected: "business.hr",
    },
    {
      name: "camera operator",
      input: { titleRu: "Нужен оператор на съёмки учебной работы" },
      expected: "media.video_production",
    },
    {
      name: "Instagram technical help",
      input: {
        titleRu: "Технический специалист",
        descriptionRu: "Помощь с настройками и техническими вопросами по Instagram и Facebook.",
      },
      expected: "business.support",
    },
    {
      name: "implementation and support engineer",
      input: { titleRu: "Инженер по внедрению и сопровождению" },
      expected: "business.support",
    },
    {
      name: "PR specialist",
      input: { titleRu: "PR-специалист по стратегии и позиционированию бренда" },
      expected: "marketing.pr",
    },
    {
      name: "fashion content production",
      input: {
        titleRu: "Контент-креатор fashion-бренда",
        descriptionRu: "Создавать контент для бренда: съёмка Reels, монтаж и публикация.",
      },
      expected: "marketing.content",
    },
    {
      name: "street promoter collecting leads",
      input: {
        titleRu: "Промоутер на улице",
        descriptionRu: "Общаться с людьми, собирать контакты и лиды.",
      },
      expected: "business.sales",
    },
    {
      name: "lead closer",
      input: { titleEn: "FD/RD Manager and lead closer" },
      expected: "business.sales",
    },
    {
      name: "platform and CRM data operations",
      input: {
        titleRu: "Оператор внутренней платформы",
        descriptionRu: "Сбор и внесение данных, работа с CRM и обработка операций на платформе.",
      },
      expected: "business.assistant",
    },
    {
      name: "TikTok account farming for traffic",
      input: {
        titleRu: "Фармер TikTok-аккаунтов",
        tags: ["traffic", "antidetect", "прогрев аккаунтов"],
      },
      expected: "marketing.ads",
    },
    {
      name: "generic design offer",
      input: { titleRu: "Предлагаю услуги дизайнера" },
      expected: "design.graphic",
    },
    {
      name: "chat operator",
      input: { titleRu: "Оператор чата для помощи клиентам" },
      expected: "business.support",
    },
    {
      name: "project coordinator",
      input: { titleRu: "Координатор проектов" },
      expected: "management.project",
    },
    {
      name: "Tilda to GetCourse access automation",
      input: {
        titleRu: "Интеграция Tilda с GetCourse",
        descriptionRu: "Настроить автоматическую выдачу доступа после оплаты.",
      },
      expected: "automation.bots_nocode",
    },
    {
      name: "segmented lifecycle newsletters",
      input: { titleRu: "Настроить сегментированные email-рассылки и цепочки писем" },
      expected: "marketing.crm",
    },
    {
      name: "influence manager",
      input: { titleRu: "Influence-менеджер по работе с блогерами" },
      expected: "marketing.influencer",
    },
    {
      name: "Reply Guy for X",
      input: { titleEn: "Reply Guy for X / Twitter community" },
      expected: "marketing.smm",
    },
    {
      name: "SMM role outweighs the employer's catering industry",
      input: {
        titleRu: "Ищем SMM-специалиста",
        descriptionRu:
          "Event-проект проводит корпоративы, выездные бары и кейтеринг. Нужен SMM для контент-плана, постов и Reels.",
      },
      expected: "marketing.smm",
    },
    {
      name: "restaurant waiter",
      input: { titleRu: "Официант в ресторан" },
      expected: "business.hospitality",
    },
    {
      name: "festival food truck",
      input: { titleRu: "Ищу фудтрак с едой на фестиваль" },
      expected: "business.hospitality",
    },
    {
      name: "food-service seller",
      input: { titleRu: "Требуется продавец сахарной ваты" },
      expected: "business.hospitality",
    },
    {
      name: "HoReCa sales remains sales",
      input: { titleEn: "Sales manager HoReCa" },
      expected: "business.sales",
    },
  ] as const;

  for (const { name, input, expected } of cases) {
    assert.equal(classifyContractCategory(input).categoryId, expected, name);
  }
});

test("classifier uses descriptions with lower confidence than an explicit title", () => {
  const result = classifyContractCategory({
    descriptionRu: "Нужен специалист, который будет настраивать контекстную рекламу в Яндекс Директ.",
  });

  assert.equal(result.categoryId, "marketing.ads");
  assert.notEqual(result.confidence, "low");
});

test("broad freelance channel tags cannot decide scout category", () => {
  assert.deepEqual(
    classifyContractCategory({ tags: ["General Freelance", "Удалёнка", "Вакансии"] }),
    {
      categoryId: "other.manual",
      confidence: "low",
      score: 0,
      evidence: [],
    },
  );
});

test("classifier output is deterministic", () => {
  const input = {
    titleRu: "Ищем SMM-менеджера",
    descriptionEn: "Social media manager for Telegram and Instagram",
    tags: ["marketing", "remote"],
  } as const;

  assert.deepEqual(classifyContractCategory(input), classifyContractCategory(input));
  assert.equal(classifyContractCategory(input).categoryId, "marketing.smm");
});
