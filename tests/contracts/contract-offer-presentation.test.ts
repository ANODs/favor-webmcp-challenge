import assert from "node:assert/strict";
import test from "node:test";

import { getContractOfferTexts } from "../../src/entities/contract/model/presentation";

test("a service offer starts a deal instead of opening a second contract flow", () => {
  const copy = getContractOfferTexts("offer", false, false, {
    proposalTitle: "Deal proposal",
    startTitle: "Start a deal",
    guestDescription: "Sign in",
    claimableDescription: "Claim this contract",
    orderDescription: "Propose terms",
    offerDescription: "Start from this service",
    orderMessagePlaceholder: "Order message",
    offerMessagePlaceholder: "Service message",
    orderSubmitLabel: "Send proposal",
    offerSubmitLabel: "Start deal",
  });

  assert.equal(copy.title, "Start a deal");
  assert.equal(copy.submitLabel, "Start deal");
});
