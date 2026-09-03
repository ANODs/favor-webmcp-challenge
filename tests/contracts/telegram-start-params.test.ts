import assert from "node:assert/strict";
import test from "node:test";

import {
  buildContractDealIntentStartParam,
  buildContractPublicationDraftStartParam,
  buildContractStartParam,
  buildProfileStartParam,
  buildTelegramBotStartUrl,
  buildTelegramChannelBotAdminUrl,
  isContractPublicationDraftToken,
  parseContractPublicationDraftStartParam,
  parseReferralTelegramId,
  resolveRouteFromStartParam,
} from "../../src/shared/lib/telegram/links";

const publicationDraftToken = "aB3_-contractDraftToken_1234567890";

test("channel admin link requests only the right needed to edit posts", () => {
  assert.equal(
    buildTelegramChannelBotAdminUrl("@FavorDealsBot"),
    "https://t.me/FavorDealsBot?startchannel&admin=edit_messages",
  );
});

test("notification recovery opens the private bot chat with a start payload", () => {
  assert.equal(
    buildTelegramBotStartUrl("@FavorDealsBot", "notifications"),
    "https://t.me/FavorDealsBot?start=notifications",
  );
});

test("contract share start param carries the referrer and keeps its destination", () => {
  const startParam = buildContractStartParam("saas-landing", 42424241n);

  assert.equal(startParam, "ref_42424241__contract_saas-landing");
  assert.equal(parseReferralTelegramId(startParam), 42424241n);
  assert.equal(resolveRouteFromStartParam(startParam), "/contracts/saas-landing");
});

test("contract deal intent carries the sender referral and opens the existing contract flow", () => {
  const startParam = buildContractDealIntentStartParam(
    "saas-landing",
    777000004n,
  );

  assert.equal(startParam, "ref_777000004__contract_deal_saas-landing");
  assert.equal(parseReferralTelegramId(startParam), 777000004n);
  assert.equal(
    resolveRouteFromStartParam(startParam),
    "/contracts/saas-landing?intent=deal",
  );
});

test("profile share start param carries the referrer and keeps its destination", () => {
  const startParam = buildProfileStartParam("tim_dev", "777000002");

  assert.equal(startParam, "ref_777000002__profile_tim_dev");
  assert.equal(parseReferralTelegramId(startParam), 777000002n);
  assert.equal(resolveRouteFromStartParam(startParam), "/profile/tim_dev");
});

test("legacy destination and referral start params remain supported", () => {
  assert.equal(buildContractStartParam("legacy-contract"), "contract_legacy-contract");
  assert.equal(buildProfileStartParam("legacy_profile"), "profile_legacy_profile");
  assert.equal(resolveRouteFromStartParam("contract_legacy-contract"), "/contracts/legacy-contract");
  assert.equal(resolveRouteFromStartParam("profile_legacy_profile"), "/profile/legacy_profile");
  assert.equal(parseReferralTelegramId("ref_777000003"), 777000003n);
});

test("malformed referral ids are not attached or parsed", () => {
  assert.equal(buildContractStartParam("safe-contract", "not-an-id"), "contract_safe-contract");
  assert.equal(parseReferralTelegramId("ref_bad__contract_safe-contract"), null);
});

test("publication draft start param opens the protected draft in the create flow", () => {
  const startParam = buildContractPublicationDraftStartParam(
    publicationDraftToken,
  );

  assert.equal(startParam, `draft_${publicationDraftToken}`);
  assert.equal(
    parseContractPublicationDraftStartParam(startParam),
    publicationDraftToken,
  );
  assert.equal(
    resolveRouteFromStartParam(startParam),
    `/contracts/new?draft=${publicationDraftToken}`,
  );
});

test("publication draft tokens reject short or malformed values", () => {
  assert.equal(isContractPublicationDraftToken("too-short"), false);
  assert.equal(isContractPublicationDraftToken(`${publicationDraftToken}.`), false);
  assert.equal(parseContractPublicationDraftStartParam("draft_too-short"), null);
  assert.throws(() => buildContractPublicationDraftStartParam("too-short"));
});
