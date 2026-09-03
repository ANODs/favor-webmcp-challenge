import assert from "node:assert/strict";
import test from "node:test";

import {
  DEAL_BRIEF_RESOURCE_LIMIT,
  dealBriefResourcesSchema,
  normalizeDealBriefResources,
} from "../../src/entities/deal/model/brief-resources";
import { getDealProposalValidation } from "../../src/features/initiate-contract-deal/model/proposal-draft";

test("deal brief resources accept labeled Figma and Google Drive links", () => {
  const resources = [
    {
      kind: "link" as const,
      url: "https://www.figma.com/design/example",
      label: "Макет",
    },
    {
      kind: "link" as const,
      url: "https://drive.google.com/drive/folders/example",
    },
  ];

  assert.deepEqual(dealBriefResourcesSchema.parse(resources), resources);
});

test("deal brief resources reject unsafe, duplicate, and excessive links", () => {
  assert.equal(
    dealBriefResourcesSchema.safeParse([
      { kind: "link", url: "javascript:alert(1)" },
    ]).success,
    false,
  );
  assert.equal(
    dealBriefResourcesSchema.safeParse([
      { kind: "link", url: "https://example.com/file" },
      { kind: "link", url: "https://example.com/file" },
    ]).success,
    false,
  );
  assert.equal(
    dealBriefResourcesSchema.safeParse(
      Array.from({ length: DEAL_BRIEF_RESOURCE_LIMIT + 1 }, (_, index) => ({
        kind: "link",
        url: `https://example.com/${index}`,
      })),
    ).success,
    false,
  );
});

test("read normalization keeps valid legacy JSON entries and drops damaged ones", () => {
  assert.deepEqual(
    normalizeDealBriefResources([
      { kind: "link", url: "https://example.com/brief", label: "Brief" },
      { kind: "file", url: "https://example.com/unsupported" },
      null,
    ]),
    [{ kind: "link", url: "https://example.com/brief", label: "Brief" }],
  );
  assert.deepEqual(normalizeDealBriefResources(null), []);
});

test("proposal validation requires concrete terms and preserves a zero price", () => {
  const valid = getDealProposalValidation({
    details: "Deliver desktop and mobile layouts.",
    price: "0",
    deadlineDays: "3",
    resources: [{ url: "https://figma.com/design/example", label: "Figma" }],
  });
  const empty = getDealProposalValidation({
    details: "",
    price: "100",
    deadlineDays: "3",
    resources: [],
  });
  const missingDeadline = getDealProposalValidation({
    details: "Deliver desktop and mobile layouts.",
    price: "100",
    deadlineDays: "",
    resources: [],
  });
  const missingPrice = getDealProposalValidation({
    details: "Deliver desktop and mobile layouts.",
    price: "",
    deadlineDays: "3",
    resources: [],
  });
  const zeroEscrowPrice = getDealProposalValidation({
    details: "Deliver desktop and mobile layouts.",
    price: "0",
    deadlineDays: "3",
    resources: [],
    isEscrow: true,
  });

  assert.equal(valid.isValid, true);
  assert.equal(valid.isPriceValid, true);
  assert.equal(empty.isValid, false);
  assert.equal(empty.isDetailsValid, false);
  assert.equal(missingDeadline.isValid, false);
  assert.equal(missingDeadline.isDeadlineValid, false);
  assert.equal(missingPrice.isValid, false);
  assert.equal(missingPrice.isPriceValid, false);
  assert.equal(zeroEscrowPrice.isValid, false);
  assert.equal(zeroEscrowPrice.isPriceValid, false);
});
