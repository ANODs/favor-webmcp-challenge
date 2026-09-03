import assert from "node:assert/strict";
import test from "node:test";

import englishMessages from "../../src/shared/locales/en.json";
import russianMessages from "../../src/shared/locales/ru.json";

type MessageTree = string | { [key: string]: MessageTree };

const flattenMessageTypes = (
  value: MessageTree,
  prefix = "",
): Map<string, string> => {
  const entries = new Map<string, string>();

  if (typeof value === "string") {
    entries.set(prefix, value);
    return entries;
  }

  Object.entries(value).forEach(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    flattenMessageTypes(child, path).forEach((message, messagePath) => {
      entries.set(messagePath, message);
    });
  });

  return entries;
};

const WORKFLOW_MESSAGE_NAMESPACES = [
  ["Index.Workflow", englishMessages.Index.Workflow, russianMessages.Index.Workflow],
  ["Index.Hero", englishMessages.Index.Hero, russianMessages.Index.Hero],
  ["CreateContract", englishMessages.CreateContract, russianMessages.CreateContract],
  ["ContractQuestions", englishMessages.ContractQuestions, russianMessages.ContractQuestions],
  ["DealStatuses", englishMessages.DealStatuses, russianMessages.DealStatuses],
  ["DealTimeline", englishMessages.DealTimeline, russianMessages.DealTimeline],
  ["DealDetails", englishMessages.DealDetails, russianMessages.DealDetails],
  ["Reviews", englishMessages.Reviews, russianMessages.Reviews],
  ["ShareMenu", englishMessages.ShareMenu, russianMessages.ShareMenu],
] as const;

test("workflow and embedded UI have complete matching English and Russian keys", () => {
  WORKFLOW_MESSAGE_NAMESPACES.forEach(([namespace, englishTree, russianTree]) => {
    const english = flattenMessageTypes(englishTree as MessageTree);
    const russian = flattenMessageTypes(russianTree as MessageTree);

    assert.deepEqual(
      [...english.keys()].sort(),
      [...russian.keys()].sort(),
      `${namespace} keys differ between locales`,
    );
    assert.ok(english.size > 0, `${namespace} is empty`);
    english.forEach((value, key) => {
      assert.ok(
        value.trim().length > 0,
        `English ${namespace} message ${key} is empty`,
      );
      assert.ok(
        (russian.get(key) ?? "").trim().length > 0,
        `Russian ${namespace} message ${key} is empty`,
      );
    });
  });
});

test("workflow localized settlement value is present in both locales", () => {
  assert.equal(
    englishMessages.Index.Workflow.phone.share.settlementValue,
    "Escrow · USDT",
  );
  assert.equal(
    russianMessages.Index.Workflow.phone.share.settlementValue,
    "Эскроу · USDT",
  );
});
