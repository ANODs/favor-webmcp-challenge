import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

process.env.TELEGRAM_PROXY_URL = "direct";

const require = createRequire(import.meta.url);

test("direct Telegram transport uses native web APIs", async () => {
  const { createProxyFormData, proxyFetch } = await import(
    "../../src/shared/lib/telegram/proxy-fetch"
  );

  assert.equal(createProxyFormData() instanceof FormData, true);

  const response = await proxyFetch("data:text/plain,direct-transport");

  assert.equal(response.ok, true);
  assert.equal(await response.text(), "direct-transport");
});

test("proxy Telegram transport has a declared undici runtime", () => {
  assert.doesNotThrow(() => require.resolve("undici"));
});
