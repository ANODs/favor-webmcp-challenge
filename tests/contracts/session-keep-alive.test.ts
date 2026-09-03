import assert from "node:assert/strict";
import test from "node:test";

import { resolveSessionKeepAliveAction } from "../../src/features/session-keep-alive/model/resolve-session-keep-alive-action";

test("repeated anonymous or expired outcomes never refresh the current route", () => {
  const actions = Array.from({ length: 5 }, () =>
    resolveSessionKeepAliveAction({ status: "expired" }),
  );

  assert.deepEqual(
    actions,
    Array.from({ length: 5 }, () => ({
      userCache: "clear",
      refreshRoute: false,
    })),
  );
  assert.equal(actions.some((action) => action.refreshRoute), false);
});

test("recovering a missing access token refreshes server-rendered session state once", () => {
  assert.deepEqual(
    resolveSessionKeepAliveAction({
      status: "refreshed",
      recoveredAccess: true,
    }),
    {
      userCache: "invalidate",
      refreshRoute: true,
    },
  );
});

test("ordinary renewal updates the user cache without refreshing the route", () => {
  assert.deepEqual(
    resolveSessionKeepAliveAction({
      status: "refreshed",
      recoveredAccess: false,
    }),
    {
      userCache: "invalidate",
      refreshRoute: false,
    },
  );
});

test("an unavailable renewal leaves the current UI untouched", () => {
  assert.deepEqual(
    resolveSessionKeepAliveAction({ status: "unavailable" }),
    {
      userCache: "none",
      refreshRoute: false,
    },
  );
});
