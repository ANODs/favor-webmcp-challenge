import assert from "node:assert/strict";
import test from "node:test";

import {
  defaultContractFormState,
  mapContractFormToCreateDto,
} from "../../src/entities/contract/model/form";
import { contractPublicationDraftDataSchema } from "../../src/features/create-contract/model/publication-draft";

const validForm = {
  ...defaultContractFormState,
  titleRu: "Дизайн лендинга",
  descriptionRu: "Подготовлю дизайн лендинга и передам исходники проекта.",
  category: "design",
  tagsInput: "Figma, UI, figma",
  basePrice: "1200",
  deadlineDays: "14",
};

test("publication handoff preserves the complete browser wizard draft", () => {
  const data = contractPublicationDraftDataSchema.parse({
    version: 1,
    form: validForm,
    preview: null,
    wizard: {
      activeLanguage: "ru",
      isSourceSkipped: true,
      addTelegramPostButton: true,
    },
    locale: "ru",
  });

  assert.equal(data.form.titleRu, validForm.titleRu);
  assert.equal(data.wizard.isSourceSkipped, true);
  assert.equal(data.wizard.addTelegramPostButton, true);
  assert.deepEqual(mapContractFormToCreateDto(data.form), {
    titleRu: "Дизайн лендинга",
    titleEn: null,
    descriptionRu:
      "Подготовлю дизайн лендинга и передам исходники проекта.",
    descriptionEn: null,
    type: "offer",
    category: "design.graphic",
    tags: ["figma", "ui", "figma"],
    basePrice: 1200,
    deadlineDays: 14,
    maxOpenDeals: 3,
    telegramPostUrl: null,
    telegramChannelUrl: null,
    cachedTelegramText: null,
    mediaRefs: [],
    isScouting: false,
    scoutedTelegramUsername: null,
    isEscrow: true,
    escrowCurrency: "TON",
  });
});

test("publication handoff rejects oversized media collections", () => {
  const result = contractPublicationDraftDataSchema.safeParse({
    version: 1,
    form: {
      ...validForm,
      mediaRefs: Array.from({ length: 21 }, (_, index) =>
        `https://example.com/image-${index}.jpg`,
      ),
    },
    preview: null,
    wizard: {
      activeLanguage: "ru",
      isSourceSkipped: false,
    },
    locale: "ru",
  });

  assert.equal(result.success, false);
});

test("legacy publication handoffs default the Telegram button choice to off", () => {
  const data = contractPublicationDraftDataSchema.parse({
    version: 1,
    form: validForm,
    preview: null,
    wizard: {
      activeLanguage: "ru",
      isSourceSkipped: true,
    },
    locale: "ru",
  });

  assert.equal(data.wizard.addTelegramPostButton, false);
});
