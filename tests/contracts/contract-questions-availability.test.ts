import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

import { ContractStatus } from "@prisma/client";

import { areContractQuestionsEnabled } from "../../src/entities/contract/model/scouting";

const require = createRequire(import.meta.url);
const { isContractQuestionAnswerableByAuthor } = require(
  "../../bot/src/features/handle-contract-question",
);

test("questions are enabled for active personal contracts", () => {
  assert.equal(
    areContractQuestionsEnabled({
      authorId: 10,
      scoutId: null,
      status: ContractStatus.active,
    }),
    true,
  );
});

test("questions are enabled after a scouted contract is claimed", () => {
  assert.equal(
    areContractQuestionsEnabled({
      authorId: 20,
      scoutId: 10,
      status: ContractStatus.active,
    }),
    true,
  );
});

test("questions stay disabled for unclaimed scout contracts", () => {
  assert.equal(
    areContractQuestionsEnabled({
      authorId: 10,
      scoutId: 10,
      status: ContractStatus.active,
    }),
    false,
  );
});

test("questions stay disabled until a contract is active", () => {
  assert.equal(
    areContractQuestionsEnabled({
      authorId: 10,
      scoutId: null,
      status: ContractStatus.pending_moderation,
    }),
    false,
  );
});

test("the author can answer questions on a personal contract", () => {
  assert.equal(
    isContractQuestionAnswerableByAuthor(
      { authorId: 10, scoutId: null },
      10,
    ),
    true,
  );
});

test("an unclaimed scout contract cannot receive author answers", () => {
  assert.equal(
    isContractQuestionAnswerableByAuthor(
      { authorId: 10, scoutId: 10 },
      10,
    ),
    false,
  );
});
