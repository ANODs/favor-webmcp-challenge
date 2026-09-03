/* eslint-disable @typescript-eslint/no-require-imports */
import assert from "node:assert/strict";
import test from "node:test";

const {
  parseQuestionCallback,
} = require("../../bot/src/features/handle-contract-question/callback");

test("contract question callback parser accepts only bounded question actions", () => {
  assert.deepEqual(parseQuestionCallback("cq:answer:42"), {
    action: "answer",
    questionId: 42,
  });
  assert.deepEqual(parseQuestionCallback("cq:publish:105"), {
    action: "publish",
    questionId: 105,
  });
  assert.deepEqual(parseQuestionCallback("cq:hide:7"), {
    action: "hide",
    questionId: 7,
  });
  assert.deepEqual(parseQuestionCallback("cq:dismiss:8"), {
    action: "dismiss",
    questionId: 8,
  });
  assert.equal(parseQuestionCallback("cq:delete:42"), null);
  assert.equal(parseQuestionCallback("cq:answer:not-a-number"), null);
  assert.equal(parseQuestionCallback("report:answer:42"), null);
});
