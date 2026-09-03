import assert from "node:assert/strict";
import test from "node:test";

import { buildContractContentFingerprint } from "../../src/entities/contract/server";

test("contract fingerprint ignores casing, spacing and tag order", () => {
  const first = buildContractContentFingerprint({
    titleRu: "  Сделаю лендинг ",
    descriptionRu: "Быстро   и качественно",
    category: "Разработка",
    tags: ["React", "Next.js"],
  });
  const second = buildContractContentFingerprint({
    titleRu: "сделаю ЛЕНДИНГ",
    descriptionRu: "быстро и качественно",
    category: "разработка",
    tags: ["next.js", "react"],
  });

  assert.equal(first, second);
});

test("contract fingerprint changes when content changes", () => {
  const first = buildContractContentFingerprint({ titleRu: "Первый контракт" });
  const second = buildContractContentFingerprint({ titleRu: "Другой контракт" });

  assert.notEqual(first, second);
});
