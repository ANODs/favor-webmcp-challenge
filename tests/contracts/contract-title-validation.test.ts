import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  CONTRACT_TITLE_MAX_LENGTH,
  CONTRACT_TITLE_VALIDATION_CODES,
} from "../../src/shared/config/contract";
import {
  slugifyTitle,
  validateContractTitle,
} from "../../src/shared/lib/slug";
import { getContractValidationMessage } from "../../src/entities/contract/model/form";

test("contract title validation exposes stable codes instead of localized reasons", () => {
  assert.deepEqual(validateContractTitle("four"), {
    ok: false,
    code: CONTRACT_TITLE_VALIDATION_CODES.tooShort,
  });
  assert.deepEqual(
    validateContractTitle("x".repeat(CONTRACT_TITLE_MAX_LENGTH + 1)),
    {
      ok: false,
      code: CONTRACT_TITLE_VALIDATION_CODES.tooLong,
    },
  );
  assert.deepEqual(validateContractTitle("Valid title"), { ok: true });
});

test("Cyrillic titles still transliterate without Cyrillic source literals", async () => {
  assert.equal(slugifyTitle("Дизайн и монтаж"), "dizain-i-montazh");

  const source = await readFile(
    new URL("../../src/shared/lib/slug.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /[\u0400-\u04ff]/u);
});

test("title max-length validation uses localized field copy", () => {
  const message = getContractValidationMessage(
    { code: "too_big", path: ["titleEn"] },
    {
      titleTooShort: "title-short",
      titleTooLong: "title-long",
      descriptionTooShort: "description-short",
      telegramPostUrlInvalid: "telegram-url",
      fallback: "fallback",
    },
  );

  assert.equal(message, "title-long");
});

test("contract create and edit flows never render raw server error copy", async () => {
  const clientModules = [
    "../../src/features/create-contract/lib/use-create-contract-form.ts",
    "../../src/features/edit-contract/lib/use-edit-contract-form.ts",
    "../../src/features/create-contract/ui/create-contract-form.tsx",
    "../../src/views/contract-editing-view/ui/contract-editing-view.tsx",
  ];
  const sources = await Promise.all(
    clientModules.map((modulePath) =>
      readFile(new URL(modulePath, import.meta.url), "utf8"),
    ),
  );

  for (const source of sources) {
    assert.doesNotMatch(source, /(?:error|validation)\.(?:message|reason)/u);
  }
});

test("contract mutation error modules contain no localized source literals", async () => {
  const serverModules = [
    "../../src/shared/lib/slug.ts",
    "../../src/entities/contract/model/schema.ts",
    "../../src/app/api/contracts/route.ts",
    "../../src/app/api/contracts/[slug]/route.ts",
    "../../src/app/api/contracts/[slug]/destroy/route.ts",
    "../../src/features/create-contract/server.ts",
  ];
  const sources = await Promise.all(
    serverModules.map((modulePath) =>
      readFile(new URL(modulePath, import.meta.url), "utf8"),
    ),
  );

  for (const source of sources) {
    assert.doesNotMatch(source, /[\u0400-\u04ff]/u);
  }
});
