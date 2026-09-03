import assert from "node:assert/strict";
import test from "node:test";

import {
  hasTelegramWriteAccess,
  requestTelegramWriteAccess,
} from "../../src/shared/lib/telegram/webapp";

test("a forced recovery request overrides stale initData write access", async () => {
  const globalWithWindow = globalThis as unknown as Record<string, unknown>;
  const originalWindow = globalWithWindow.window;
  let requestCalls = 0;
  let nextAllowed = false;

  globalWithWindow.window = {
    Telegram: {
      WebApp: {
        initDataUnsafe: {
          user: {
            id: 42,
            first_name: "Favor user",
            allows_write_to_pm: true,
          },
        },
        isVersionAtLeast: () => true,
        requestWriteAccess: (callback?: (allowed: boolean) => void) => {
          requestCalls += 1;
          callback?.(nextAllowed);
        },
      },
    },
  };

  try {
    assert.equal(hasTelegramWriteAccess(), true);
    assert.equal(
      await requestTelegramWriteAccess({ force: true }),
      "denied",
    );
    assert.equal(requestCalls, 1);
    assert.equal(hasTelegramWriteAccess(), false);

    nextAllowed = true;
    assert.equal(await requestTelegramWriteAccess(), "allowed");
    assert.equal(requestCalls, 2);
    assert.equal(hasTelegramWriteAccess(), true);

    assert.equal(await requestTelegramWriteAccess(), "allowed");
    assert.equal(requestCalls, 2);
  } finally {
    if (originalWindow === undefined) {
      Reflect.deleteProperty(globalWithWindow, "window");
    } else {
      globalWithWindow.window = originalWindow;
    }
  }
});
