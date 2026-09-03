import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { CONTRACT_OG_COVER_STATE } from "../../src/entities/contract/model/og-image";
import { loadContractOgCoverImage } from "../../src/entities/contract/server/og-image-cover";

const coverUrl = "https://cdn4.telesco.pe/file/cover.jpg";
const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43]);

test("contract OG embeds a bounded trusted cover image", async () => {
  const result = await loadContractOgCoverImage(
    [coverUrl],
    async (_input, init) => {
      assert.equal(init?.redirect, "error");
      assert.equal(
        init?.headers && new Headers(init.headers).get("accept"),
        "image/webp,image/png,image/jpeg",
      );

      return new Response(jpegBytes, {
        headers: { "Content-Type": "image/jpeg" },
      });
    },
  );

  assert.deepEqual(result, {
    state: CONTRACT_OG_COVER_STATE.embedded,
    dataUrl: `data:image/jpeg;base64,${Buffer.from(jpegBytes).toString("base64")}`,
    imageHost: "cdn4.telesco.pe",
  });
});

test("contract OG distinguishes contracts without a cover", async () => {
  const result = await loadContractOgCoverImage([], async () => {
    assert.fail("fetch must not run without a trusted cover URL");
  });

  assert.deepEqual(result, {
    state: CONTRACT_OG_COVER_STATE.none,
    dataUrl: null,
    imageHost: null,
  });
});

test("contract OG reports transient and invalid cover failures", async () => {
  let networkAttempts = 0;
  const networkFailure = await loadContractOgCoverImage([coverUrl], async () => {
    networkAttempts += 1;
    throw new Error("unavailable");
  });
  const unsupportedType = await loadContractOgCoverImage(
    [coverUrl],
    async () => new Response("not an image", {
      headers: { "Content-Type": "text/plain" },
    }),
  );
  const invalidSignature = await loadContractOgCoverImage(
    [coverUrl],
    async () => new Response("not really a jpeg", {
      headers: { "Content-Type": "image/jpeg" },
    }),
  );

  assert.equal(networkFailure.state, CONTRACT_OG_COVER_STATE.unavailable);
  assert.equal(unsupportedType.state, CONTRACT_OG_COVER_STATE.unavailable);
  assert.equal(invalidSignature.state, CONTRACT_OG_COVER_STATE.unavailable);

  if (
    networkFailure.state !== CONTRACT_OG_COVER_STATE.unavailable ||
    unsupportedType.state !== CONTRACT_OG_COVER_STATE.unavailable ||
    invalidSignature.state !== CONTRACT_OG_COVER_STATE.unavailable
  ) {
    assert.fail("cover failures must remain observable");
  }

  assert.equal(networkFailure.reason, "network_error");
  assert.equal(networkFailure.errorName, "Error");
  assert.equal(networkFailure.imageHost, "cdn4.telesco.pe");
  assert.equal(networkAttempts, 2);
  assert.equal(unsupportedType.reason, "unsupported_content_type");
  assert.equal(unsupportedType.contentType, "text/plain");
  assert.equal(invalidSignature.reason, "invalid_image_signature");
});

test("contract OG retries a temporary Telegram CDN error", async () => {
  let attempts = 0;
  const result = await loadContractOgCoverImage([coverUrl], async () => {
    attempts += 1;

    if (attempts === 1) {
      return new Response(null, { status: 500 });
    }

    return new Response(jpegBytes, {
      headers: { "Content-Type": "image/jpeg" },
    });
  });

  assert.equal(attempts, 2);
  assert.equal(result.state, CONTRACT_OG_COVER_STATE.embedded);
});

test("contract OG does not retry a permanent CDN response", async () => {
  let attempts = 0;
  const result = await loadContractOgCoverImage([coverUrl], async () => {
    attempts += 1;
    return new Response(null, { status: 404 });
  });

  assert.equal(attempts, 1);
  assert.equal(result.state, CONTRACT_OG_COVER_STATE.unavailable);

  if (result.state !== CONTRACT_OG_COVER_STATE.unavailable) {
    assert.fail("permanent CDN errors must remain observable");
  }

  assert.equal(result.reason, "http_error");
  assert.equal(result.responseStatus, 404);
});

test("contract OG rejects a declared oversized cover before reading it", async () => {
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.enqueue(jpegBytes);
      controller.close();
    },
  });

  const result = await loadContractOgCoverImage(
    [coverUrl],
    async () => new Response(body, {
      headers: {
        "Content-Length": String(9 * 1024 * 1024),
        "Content-Type": "image/jpeg",
      },
    }),
  );

  assert.equal(result.state, CONTRACT_OG_COVER_STATE.unavailable);

  if (result.state !== CONTRACT_OG_COVER_STATE.unavailable) {
    assert.fail("oversized covers must remain observable");
  }

  assert.equal(result.reason, "declared_too_large");
});

test("contract OG uses the server Telegram transport by default", async () => {
  const source = await readFile(
    new URL(
      "../../src/entities/contract/server/og-image-cover.ts",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(
    source,
    /import \{ proxyFetch \} from "@\/shared\/lib\/telegram\/server";/,
  );
  assert.match(source, /fetchImage: ContractOgCoverFetch = proxyFetch/);
  assert.doesNotMatch(source, /fetchImage: ContractOgCoverFetch = fetch/);
});
