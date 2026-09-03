import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_APP_VERSION,
  formatAppVersion,
  normalizeCommitSha,
} from "../../src/shared/lib/app-version";

test("starts application versions at 1.0.0 alpha", () => {
  assert.deepEqual(DEFAULT_APP_VERSION, {
    canonical: "1.0.0-alpha",
    display: "1.0.0 alpha",
  });
});

test("increments only the patch component", () => {
  assert.deepEqual(formatAppVersion(27), {
    canonical: "1.0.27-alpha",
    display: "1.0.27 alpha",
  });
});

test("rejects invalid patch values", () => {
  for (const patch of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => formatAppVersion(patch));
  }
});

test("normalizes and validates full commit SHAs", () => {
  const uppercaseSha = "A".repeat(40);

  assert.equal(normalizeCommitSha(` ${uppercaseSha} `), "a".repeat(40));
  assert.throws(() => normalizeCommitSha("abc123"));
});
