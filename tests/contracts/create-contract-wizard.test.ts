import assert from "node:assert/strict";
import test from "node:test";

import {
  defaultContractFormState,
  type ContractFormState,
} from "../../src/entities/contract/model/form";
import {
  isContractLanguageVersionComplete,
  validateContractContentStep,
} from "../../src/features/create-contract/lib/content-step-validation";

const messages = {
  atLeastOneVersion: "at-least-one",
  titleRequired: "title-required",
  titleTooShort: "title-short",
  titleTooLong: "title-long",
  descriptionRequired: "description-required",
  descriptionTooShort: "description-short",
};

const formWith = (
  patch: Partial<ContractFormState>,
): ContractFormState => ({
  ...defaultContractFormState,
  ...patch,
});

test("accepts one complete language version", () => {
  const form = formWith({
    titleRu: "Дизайн лендинга",
    descriptionRu: "Подготовлю дизайн лендинга и передам исходники.",
  });

  assert.equal(isContractLanguageVersionComplete(form, "ru"), true);
  assert.deepEqual(validateContractContentStep(form, messages), {
    errors: {},
    isValid: true,
    preferredLanguage: "ru",
  });
});

test("accepts English when Russian is empty", () => {
  const form = formWith({
    titleEn: "Landing page design",
    descriptionEn: "I will design a landing page and provide source files.",
  });

  const result = validateContractContentStep(form, messages);

  assert.equal(result.isValid, true);
  assert.equal(result.preferredLanguage, "en");
  assert.deepEqual(result.errors, {});
});

test("requires at least one language version", () => {
  const result = validateContractContentStep(
    formWith({}),
    messages,
  );

  assert.equal(result.isValid, false);
  assert.equal(result.preferredLanguage, "ru");
  assert.equal(result.errors.titleRu, "at-least-one");
});

test("does not allow an incomplete second language version", () => {
  const result = validateContractContentStep(
    formWith({
      titleRu: "Дизайн лендинга",
      descriptionRu: "Подготовлю дизайн лендинга и передам исходники.",
      titleEn: "Draft",
    }),
    messages,
  );

  assert.equal(result.isValid, false);
  assert.equal(result.preferredLanguage, "en");
  assert.equal(result.errors.descriptionEn, "description-required");
});

test("rejects a title that exceeds the contract title limit", () => {
  const result = validateContractContentStep(
    formWith({
      titleEn: "x".repeat(121),
      descriptionEn: "A sufficiently long contract description.",
    }),
    messages,
  );

  assert.equal(result.isValid, false);
  assert.equal(result.preferredLanguage, "en");
  assert.equal(result.errors.titleEn, "title-long");
});
