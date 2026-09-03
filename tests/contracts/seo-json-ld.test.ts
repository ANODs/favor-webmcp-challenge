import assert from "node:assert/strict";
import test from "node:test";

import { serializeJsonLd } from "../../src/shared/lib/seo";

test("JSON-LD serialization cannot terminate its script element", () => {
  const serialized = serializeJsonLd({
    description: "</script><script>alert('unsafe')</script>",
  });

  assert.doesNotMatch(serialized, /</);
  assert.match(serialized, /\\u003c\/script>/);
  assert.deepEqual(JSON.parse(serialized), {
    description: "</script><script>alert('unsafe')</script>",
  });
});
