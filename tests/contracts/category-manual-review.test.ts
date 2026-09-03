import assert from "node:assert/strict";
import test from "node:test";

import { classifyContractCategory } from "../../src/entities/category/model/classifier";

type ManualReviewCase = Readonly<{
  id: number | string;
  expected: string;
  titleRu: string;
  descriptionRu?: string;
  tags?: readonly string[];
}>;

const cases: readonly ManualReviewCase[] = [
  {
    id: 1272,
    expected: "media.performance",
    titleRu: "Требуются творческие люди",
    descriptionRu:
      "Мы тестируем нейронную сеть. Ваша задача — прийти в офис и снять несколько коротких видео: эмоции, фразы, мимика.",
  },
  {
    id: 1211,
    expected: "marketing.ads",
    titleRu: "Ищут опытного специалиста для настройки и последующего ведения рекламных кампаний",
    descriptionRu:
      "Специалист по Яндекс Директ: настраивать кампании, собирать ключевые запросы и анализировать результаты.",
    tags: ["вакансия", "яндексдирект", "контекстнаяреклама", "удаленно"],
  },
  {
    id: 1199,
    expected: "education.training",
    titleRu: "Стажер по внешнему обучению в КРОК",
    descriptionRu:
      "Создаем образовательные программы, ищем лучшие курсы и конференции, регистрируем сотрудников на обучение.",
  },
  {
    id: 1184,
    expected: "business.events",
    titleRu: "Требуется монтировщик на ПОСТОЯННУЮ ОСНОВУ",
    descriptionRu:
      "Театр: проведение спектаклей, осуществление монтажей и демонтажей, готовность к физическим нагрузкам.",
    tags: ["монтировщик"],
  },
  {
    id: 1179,
    expected: "marketing.content",
    titleRu: "Необычная удалённая вакансия",
    descriptionRu:
      "Проверять материалы, работать с контентом и выполнять несложные задачи через онлайн-сервисы.",
    tags: ["удаленная_работа"],
  },
  {
    id: 1154,
    expected: "education.training",
    titleRu: "Требуются вожатые в дневные образовательные летние лагеря в августе",
    descriptionRu: "Смены «Город исследователей» и «Как всё устроено» для детей.",
    tags: ["вожатые"],
  },
  {
    id: 1153,
    expected: "business.hospitality",
    titleRu: "Ищу фудтрак на спортивный фестиваль в Карелии",
    descriptionRu:
      "Нужна именно еда: шаверма, хот-дог, вок или шашлык; ожидаются участники и гости фестиваля.",
  },
  {
    id: 1112,
    expected: "business.development",
    titleRu: "Менеджер по привлечению и развитию клиентов",
    descriptionRu:
      "Привлекать новых участников и коммерческих партнёров, развивать отношения и предлагать идеи для монетизации проектов.",
  },
  {
    id: 1075,
    expected: "business.hr",
    titleRu: "HR менеджер в агентство бизнес-решений",
    descriptionRu:
      "Проводить собеседования, активно искать кандидатов, анализировать резюме и формировать базу специалистов.",
  },
  {
    id: 1045,
    expected: "media.video_production",
    titleRu: "Нужен оператор на съемки учебной работы в киношколе",
    descriptionRu: "Работа с режиссером. Только съемка, без монтажа; сдать материал на площадке.",
    tags: ["оператора"],
  },
  {
    id: 1015,
    expected: "business.support",
    titleRu: "Технический специалист",
    descriptionRu: "Помогать с настройками и техническими вопросами по Instagram и Facebook.",
  },
  {
    id: 1011,
    expected: "marketing.pr",
    titleRu: "PR-специалист в Find Mind Agency",
    descriptionRu:
      "Разработка PR-стратегии бренда, позиционирование, отношения с инфлюенсерами и коллаборации.",
  },
  {
    id: 1000,
    expected: "business.support",
    titleRu: "Ищем Инженера по внедрению и сопровождению",
    descriptionRu:
      "Поддержка пользователей, помощь клиентам при интеграции, решение инцидентов и ведение базы знаний.",
  },
  {
    id: 970,
    expected: "education.training",
    titleRu: "Почему 9 из 10 резюме сейчас улетают в корзину без ответа",
    descriptionRu:
      "Канал ведут карьерные консультанты: практика и понятные инструкции по поиску работы, резюме и собеседованиям.",
  },
  {
    id: 959,
    expected: "marketing.content",
    titleRu: "Ищем человека, который поможет создавать стильный контент для бренда",
    descriptionRu:
      "Участвовать в разработке идей и сценариев, снимать и монтировать Reels, понимать эстетику fashion.",
  },
  {
    id: 928,
    expected: "business.sales",
    titleRu: "Требуется промоутер",
    descriptionRu:
      "Подходить к родителям, рассказывать о пробной тренировке и записывать квалифицированные контакты.",
    tags: ["промоутер"],
  },
  {
    id: 916,
    expected: "business.assistant",
    titleRu: "Удалённая работа: специалист на дому без опыта",
    descriptionRu: "Сбор информации, формирование отчета, проверка точности данных и заполнение CRM.",
  },
  {
    id: 878,
    expected: "marketing.ads",
    titleRu: "ИЩЕМ АГЕНТОВ TikTok",
    descriptionRu:
      "Предоставлять TikTok-аккаунты под залив рекламного трафика; стабильный объём аккаунтов и быстрая замена.",
  },
  {
    id: 791,
    expected: "design.graphic",
    titleRu: "Вакансия по направлению: Дизайн",
    descriptionRu: "Предлагаю рассмотреть портфолио и приобрести мои услуги дизайна для бренда.",
  },
  {
    id: 781,
    expected: "marketing.content",
    titleRu: "Ищут специалиста, который хорошо чувствует интернет-культуру, тренды и современный юмор",
    descriptionRu:
      "Контентщик-креативщик: придумывать рубрики, создавать посты и карусели, интегрировать продукт и делать короткие видео.",
    tags: ["вакансия", "контент", "креатив"],
  },
  {
    id: 758,
    expected: "media.performance",
    titleRu: "Ищем номер на открытие конференции",
    descriptionRu:
      "Косбенды в стиле дарк-фэнтези: это может быть танец или рыцарский поединок, 6–10 человек.",
  },
  {
    id: 733,
    expected: "business.support",
    titleRu: "Оператор-чаттер",
    descriptionRu:
      "Прием сообщений от потенциальных пользователей и общение с ними: часть по шаблону, часть индивидуально.",
  },
  {
    id: 720,
    expected: "business.hospitality",
    titleRu: "В иммерсивный бар требуется творческий человек на вакансию официант",
    descriptionRu:
      "Обслуживание гостей, импровизация и взаимодействие с гостями в рамках концепции заведения.",
    tags: ["официант"],
  },
  {
    id: 689,
    expected: "marketing.ads",
    titleRu: "Вакансия: Фармер аккаунтов",
    descriptionRu:
      "Регистрировать и прогревать аккаунты, следить за их состоянием; нужен опыт с антидетект-браузерами.",
  },
  {
    id: 619,
    expected: "management.project",
    titleRu: "Ищем менеджера на аутсорсе",
    descriptionRu:
      "Вести задачи и дедлайны, координировать процессы и команду, общаться с клиентами и подрядчиками.",
    tags: ["менеджер", "удаленная_работа"],
  },
  {
    id: 582,
    expected: "automation.bots_nocode",
    titleRu: "Технический специалист",
    descriptionRu: "Настроить автоматическую выдачу доступа на Геткурсе после оплаты с Тильды.",
  },
  {
    id: 559,
    expected: "business.assistant",
    titleRu: "Специалист по работе с онлайн-платформами",
    descriptionRu:
      "Выполнение операций по готовому алгоритму, следование инструкциям и заполнение простой отчётности.",
  },
  {
    id: 535,
    expected: "business.sales",
    titleRu: "Ищем FD/RD Manager в binary options",
    descriptionRu:
      "Обрабатывать входящие лиды, доводить до первого и повторных депозитов, прогревать и закрывать возражения.",
  },
  {
    id: 519,
    expected: "business.events",
    titleRu: "Ищу арендные пьедесталы с возможностью брендирования",
    descriptionRu:
      "Нужна конструкция на три призовых места для конкурса водительского мастерства в день мероприятия.",
  },
  {
    id: 469,
    expected: "business.support",
    titleRu: "Требуются Менеджеры в онлайн-школу",
    descriptionRu: "Работа с заявками и в соцсетях, консультации клиентов и коммуникация с людьми.",
  },
  {
    id: 429,
    expected: "marketing.crm",
    titleRu: "Вакансия — Удалённо",
    descriptionRu:
      "Писать вовлекающие и продающие рассылки, выстраивать логику касаний, сегменты и контент-план писем.",
  },
  {
    id: 414,
    expected: "media.performance",
    titleRu: "Ищу человека, который станет лицом наших Reels",
    descriptionRu:
      "Автор будет уверенно работать в кадре и записывать короткие разговорные видео по готовым сценариям.",
  },
  {
    id: 250,
    expected: "marketing.influencer",
    titleRu: "Вакансия — Удалённо: Influence marketing manager",
    descriptionRu:
      "Подбор блогеров и селебрити, коммуникация с ними и создание инфлюенс-стратегий для брендов.",
  },
  {
    id: 49,
    expected: "marketing.smm",
    titleRu: "Reply Guy в X (Twitter) (Опыт 2 года)",
    descriptionRu:
      "Ведение Crypto Twitter и Telegram аккаунтов, осмысленные реплаи и общение с комьюнити.",
    tags: ["смм", "twitter", "комьюнити"],
  },
  {
    id: 44,
    expected: "marketing.smm",
    titleRu: "Reply Guy в Twitter (X)",
    descriptionRu:
      "Работал над крипто-каналами в X, готов ежедневно отвечать и попадать в алгоритмы платформы.",
    tags: ["смм", "twitter", "контент"],
  },
  {
    id: "tiktok-promo",
    expected: "marketing.tiktok_promo",
    titleRu: "TikTok-промо трека у автора",
    descriptionRu:
      "Креатор с большой аудиторией: один промо-ролик с вашим треком и нативная интеграция в TikTok.",
    tags: ["tiktokpromo", "musicpromo", "favor"],
  },
  {
    id: "wave2-data-engineer",
    expected: "data.analytics",
    titleRu: "Старший инженер дежурной смены",
    descriptionRu:
      "SQL, Python и ETL: Greenplum, Oracle, Apache Airflow, Informatica PowerCenter, S3 и Iceberg.",
  },
  {
    id: "wave2-event-model",
    expected: "media.performance",
    titleRu: "Ищем девушку азиатской внешности",
    descriptionRu:
      "Нужно находиться на мероприятии в образе, без сложной анимации.",
  },
] as const;

for (const { id, expected, ...input } of cases) {
  test(`manual production review ${id} resolves to ${expected}`, () => {
    const result = classifyContractCategory(input);
    assert.equal(
      result.categoryId,
      expected,
      `${id}: expected ${expected}, got ${result.categoryId}; ${result.evidence.join(", ")}`,
    );
  });
}
