import assert from "node:assert/strict";
import test from "node:test";

import {
  serializeContractScoutForFeedViewer,
  serializeContractTelegramSourceForViewer,
} from "../../src/entities/contract/server/telegram-source-serialization";

const contract = {
  id: 42,
  authorId: 10,
  scoutId: 20,
  telegramPostUrl: "https://t.me/freelance/123",
  telegramChannelUrl: "https://t.me/freelance",
  cachedTelegramText: "Original Telegram post",
  scoutedTelegramUsername: "source_author",
};

test("Telegram scouting source is hidden from anonymous and unrelated viewers", () => {
  for (const viewer of [null, { id: 30, role: "customer" }]) {
    const result = serializeContractTelegramSourceForViewer(contract, viewer);

    assert.equal(result.telegramPostUrl, null);
    assert.equal(result.telegramChannelUrl, null);
    assert.equal(result.cachedTelegramText, null);
    assert.equal(result.scoutedTelegramUsername, null);
    assert.equal(result.id, contract.id);
  }
});

test("Telegram scouting source remains available to the author, scout, and moderator", () => {
  const privilegedViewers = [
    { id: contract.authorId, role: "customer" },
    { id: contract.scoutId, role: "freelancer" },
    { id: 30, role: "moderator" },
  ];

  for (const viewer of privilegedViewers) {
    const result = serializeContractTelegramSourceForViewer(contract, viewer);

    assert.equal(result.telegramPostUrl, contract.telegramPostUrl);
    assert.equal(result.telegramChannelUrl, contract.telegramChannelUrl);
    assert.equal(result.cachedTelegramText, contract.cachedTelegramText);
    assert.equal(
      result.scoutedTelegramUsername,
      contract.scoutedTelegramUsername,
    );
  }
});

test("an authorized contact reveal exposes source links but not private scouting data", () => {
  const result = serializeContractTelegramSourceForViewer(
    contract,
    { id: 30, role: "customer" },
    { revealTelegramLinks: true },
  );

  assert.equal(result.telegramPostUrl, contract.telegramPostUrl);
  assert.equal(result.telegramChannelUrl, contract.telegramChannelUrl);
  assert.equal(result.cachedTelegramText, null);
  assert.equal(result.scoutedTelegramUsername, null);
});

test("feed scout identity is hidden from anonymous and unrelated viewers", () => {
  const scout = {
    id: contract.scoutId,
    name: "Scout Name",
    telegramUsername: "scout_handle",
    isTelegramUsernameHidden: false,
    rating: 5,
  };

  for (const viewer of [null, { id: 30, role: "customer" }]) {
    const result = serializeContractScoutForFeedViewer(scout, viewer);

    assert.equal(result?.name, null);
    assert.equal(result?.telegramUsername, null);
    assert.equal(result?.rating, scout.rating);
  }
});

test("feed scout identity is available only to the scout or moderator and respects username privacy", () => {
  const visibleScout = {
    id: contract.scoutId,
    name: "Scout Name",
    telegramUsername: "scout_handle",
    isTelegramUsernameHidden: false,
  };
  const hiddenScout = {
    ...visibleScout,
    isTelegramUsernameHidden: true,
  };

  for (const viewer of [
    { id: contract.scoutId, role: "freelancer" },
    { id: 30, role: "moderator" },
  ]) {
    const visible = serializeContractScoutForFeedViewer(visibleScout, viewer);
    const hidden = serializeContractScoutForFeedViewer(hiddenScout, viewer);

    assert.equal(visible?.name, visibleScout.name);
    assert.equal(visible?.telegramUsername, visibleScout.telegramUsername);
    assert.equal(hidden?.name, hiddenScout.name);
    assert.equal(hidden?.telegramUsername, null);
  }
});

test("serializing a public view does not mutate the database-shaped input", () => {
  const input = { ...contract };

  serializeContractTelegramSourceForViewer(input, null);

  assert.deepEqual(input, contract);
});
