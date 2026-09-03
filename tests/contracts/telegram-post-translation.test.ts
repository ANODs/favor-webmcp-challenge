import assert from "node:assert/strict";
import test from "node:test";

import {
  applyTelegramPreviewToForm,
  defaultContractFormState,
} from "../../src/entities/contract/model/form";
import { parseGlmTelegramPostTranslation } from "../../src/features/create-contract/server/telegram-post-translation";

const translation = {
  titleRu: "Дизайн обложки музыкального релиза",
  titleEn: "Music release cover design",
  descriptionRu:
    "Нужен дизайнер для создания обложки музыкального релиза. Срок выполнения — три дня.",
  descriptionEn:
    "A designer is needed to create a music release cover. The deadline is three days.",
};

test("premium Telegram translation fills editable Russian and English fields", () => {
  const result = applyTelegramPreviewToForm(defaultContractFormState, {
    telegramPostUrl: "https://t.me/favor/42",
    telegramChannelUrl: "https://t.me/favor",
    description: translation.descriptionRu,
    images: ["https://example.com/cover.jpg"],
    translation,
  });

  assert.equal(result.titleRu, translation.titleRu);
  assert.equal(result.titleEn, translation.titleEn);
  assert.equal(result.descriptionRu, translation.descriptionRu);
  assert.equal(result.descriptionEn, translation.descriptionEn);
  assert.equal(result.cachedTelegramText, translation.descriptionRu);
});

test("non-premium Telegram preview preserves the existing import behavior", () => {
  const result = applyTelegramPreviewToForm(
    {
      ...defaultContractFormState,
      titleRu: "Черновой заголовок",
      titleEn: "Draft title",
    },
    {
      telegramPostUrl: "https://t.me/favor/42",
      telegramChannelUrl: "https://t.me/favor",
      description: translation.descriptionRu,
      images: [],
    },
  );

  assert.equal(result.titleRu, "Черновой заголовок");
  assert.equal(result.titleEn, "Draft title");
  assert.equal(result.descriptionRu, translation.descriptionRu);
  assert.equal(result.descriptionEn, "");
});

test("GLM translation parser accepts structured JSON wrapped in a code fence", () => {
  const result = parseGlmTelegramPostTranslation(
    `\`\`\`json\n${JSON.stringify(translation)}\n\`\`\``,
  );

  assert.deepEqual(result, translation);
});
