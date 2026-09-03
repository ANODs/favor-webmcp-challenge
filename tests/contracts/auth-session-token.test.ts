import assert from "node:assert/strict";
import test from "node:test";
import { Role } from "@prisma/client";
import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";

process.env.JWT_SECRET = "auth-session-token-test-secret";

const sessionSubject = {
  userId: 42,
  role: Role.customer,
  telegramId: "476898212",
};

test("access and refresh tokens are purpose-bound", async () => {
  const {
    signAuthRefreshToken,
    signAuthToken,
    verifyDevAuthToken,
    verifyAuthRefreshToken,
    verifyStoredAuthToken,
  } = await import("../../src/shared/lib/auth-session");

  const accessToken = signAuthToken(sessionSubject);
  const refreshToken = signAuthRefreshToken(sessionSubject);

  assert.deepEqual(verifyDevAuthToken(accessToken), sessionSubject);
  assert.deepEqual(
    {
      userId: verifyAuthRefreshToken(refreshToken).userId,
      role: verifyAuthRefreshToken(refreshToken).role,
      telegramId: verifyAuthRefreshToken(refreshToken).telegramId,
    },
    sessionSubject,
  );
  assert.throws(
    () => verifyDevAuthToken(refreshToken),
    /Invalid development authentication token payload/,
  );
  assert.throws(
    () => verifyAuthRefreshToken(accessToken),
    /Invalid refresh token payload/,
  );

  const sessionId = "dd5fda3e-81b0-4d88-9894-49bd0e6e8db0";
  const boundAccessToken = signAuthToken(
    sessionSubject,
    undefined,
    sessionId,
  );
  assert.equal(
    verifyStoredAuthToken(boundAccessToken, sessionId).sessionId,
    sessionId,
  );
  assert.throws(
    () => verifyDevAuthToken(boundAccessToken),
    /Invalid development authentication token payload/,
  );
  assert.throws(
    () =>
      verifyStoredAuthToken(
        boundAccessToken,
        "2cb6c68f-4d0b-4f34-80a9-940c76be9b83",
      ),
    /Invalid stored authentication token payload/,
  );
});

test("legacy access tokens remain valid only as access tokens", async () => {
  const { env } = await import("../../src/shared/config/env");
  const {
    verifyAuthRefreshToken,
    verifyDevAuthToken,
    verifyLegacyAuthToken,
  } = await import("../../src/shared/lib/auth-session");
  const legacyToken = jwt.sign(sessionSubject, env.jwtSecret, { expiresIn: "7d" });

  assert.deepEqual(verifyLegacyAuthToken(legacyToken), sessionSubject);
  assert.throws(
    () => verifyDevAuthToken(legacyToken),
    /Invalid development authentication token payload/,
  );
  assert.throws(
    () => verifyAuthRefreshToken(legacyToken),
    /Invalid refresh token payload/,
  );

  const modernAccessToken = (await import("../../src/shared/lib/auth-session"))
    .signAuthToken(sessionSubject);
  assert.throws(
    () => verifyLegacyAuthToken(modernAccessToken),
    /Expected a legacy authentication token/,
  );
  const boundModernAccessToken = (
    await import("../../src/shared/lib/auth-session")
  ).signAuthToken(
    sessionSubject,
    undefined,
    "dd5fda3e-81b0-4d88-9894-49bd0e6e8db0",
  );
  assert.throws(
    () => verifyLegacyAuthToken(boundModernAccessToken),
    /Expected a legacy authentication token/,
  );
});

test("the stateless development fallback updates auth cookies and clears the active pointer", async () => {
  const {
    AUTH_ACCESS_TOKEN_MAX_AGE_SECONDS,
    AUTH_REFRESH_TOKEN_MAX_AGE_SECONDS,
    clearAuthSessionCookies,
    setAuthSessionCookies,
  } = await import("../../src/shared/lib/auth-session");
  const { env } = await import("../../src/shared/config/env");

  const createdResponse = setAuthSessionCookies(NextResponse.json({ ok: true }), sessionSubject);
  const createdCookies = createdResponse.headers.getSetCookie();

  assert.equal(createdCookies.length, 3);
  assert.ok(
    createdCookies.some(
      (cookie) =>
        cookie.startsWith(`${env.authCookieName}=`) &&
        cookie.includes("HttpOnly") &&
        cookie.includes(`Max-Age=${AUTH_ACCESS_TOKEN_MAX_AGE_SECONDS}`),
    ),
  );
  assert.ok(
    createdCookies.some(
      (cookie) =>
        cookie.startsWith(`${env.authRefreshCookieName}=`) &&
        cookie.includes("HttpOnly") &&
        cookie.includes(`Max-Age=${AUTH_REFRESH_TOKEN_MAX_AGE_SECONDS}`),
    ),
  );

  const clearedResponse = clearAuthSessionCookies(NextResponse.json({ ok: true }));
  const clearedCookies = clearedResponse.headers.getSetCookie();

  assert.equal(clearedCookies.length, 3);
  assert.ok(clearedCookies.every((cookie) => cookie.includes("Max-Age=0")));
});

test("a valid legacy session keep-alive does not extend or clear its cookie", async () => {
  const { setRefreshedAuthSessionCookies } = await import(
    "../../src/shared/lib/auth"
  );
  const response = NextResponse.json({ ok: true });

  const refreshedResponse = setRefreshedAuthSessionCookies(response, {
    storage: "legacy",
    session: sessionSubject,
    recoveredAccess: false,
  });

  assert.equal(refreshedResponse, response);
  assert.deepEqual(refreshedResponse.headers.getSetCookie(), []);
});

test("a late refresh response cannot overwrite the active login session", async () => {
  const {
    clearAuthSessionCookies,
    setStoredAuthSessionCookies,
    verifyStoredAuthToken,
  } = await import(
    "../../src/shared/lib/auth-session"
  );
  const {
    authSessionIdCookieName,
    getAuthSessionAccessCookieName,
    getAuthSessionRefreshCookieName,
  } = await import("../../src/shared/lib/auth-session-cookie");
  const sessionA = "bdbace3d-3d43-4acd-930d-9bfcbbef322e";
  const sessionB = "aa51660f-1f86-40c0-b3f4-7dbc62edc3d1";
  const startedAt = new Date();
  const expiresAt = new Date(startedAt.getTime() + 60 * 60 * 1000);

  const loginResponse = setStoredAuthSessionCookies(
    NextResponse.json({ ok: true }),
    sessionSubject,
    {
      sessionId: sessionB,
      refreshToken: "refresh-b",
      startedAt,
      expiresAt,
    },
    { activateSession: true },
  );
  const loginCookies = loginResponse.headers.getSetCookie();
  assert.ok(
    loginCookies.some((cookie) =>
      cookie.startsWith(`${authSessionIdCookieName}=${sessionB}`),
    ),
  );
  assert.ok(
    loginCookies.some((cookie) =>
      cookie.startsWith(`${getAuthSessionAccessCookieName(sessionB)}=`),
    ),
  );
  const boundAccessCookie = loginCookies.find((cookie) =>
    cookie.startsWith(`${getAuthSessionAccessCookieName(sessionB)}=`),
  );
  assert.ok(boundAccessCookie);
  const boundAccessToken = boundAccessCookie.split("=", 2)[1].split(";", 1)[0];
  assert.equal(
    verifyStoredAuthToken(boundAccessToken, sessionB).sessionId,
    sessionB,
  );

  const lateRefreshResponse = setStoredAuthSessionCookies(
    NextResponse.json({ ok: true }),
    sessionSubject,
    {
      sessionId: sessionA,
      refreshToken: "rotated-refresh-a",
      startedAt,
      expiresAt,
    },
    { activateSession: false },
  );
  const lateRefreshCookies = lateRefreshResponse.headers.getSetCookie();

  assert.equal(lateRefreshCookies.length, 2);
  assert.ok(
    lateRefreshCookies.some((cookie) =>
      cookie.startsWith(`${getAuthSessionAccessCookieName(sessionA)}=`),
    ),
  );
  assert.ok(
    lateRefreshCookies.some((cookie) =>
      cookie.startsWith(`${getAuthSessionRefreshCookieName(sessionA)}=`),
    ),
  );
  assert.ok(
    lateRefreshCookies.every(
      (cookie) =>
        !cookie.startsWith(`${authSessionIdCookieName}=`) &&
        !cookie.startsWith(`${getAuthSessionAccessCookieName(sessionB)}=`) &&
        !cookie.startsWith(`${getAuthSessionRefreshCookieName(sessionB)}=`),
    ),
  );

  const lateFailureCookies = clearAuthSessionCookies(
    NextResponse.json({ ok: false }),
    { sessionId: sessionA, clearActiveSession: false },
  ).headers.getSetCookie();
  assert.ok(
    lateFailureCookies.every(
      (cookie) => !cookie.startsWith(`${authSessionIdCookieName}=`),
    ),
  );
});

test("refresh token reuse is accepted only during the concurrent-tab grace window", async () => {
  const {
    AUTH_REFRESH_ROTATION_GRACE_SECONDS,
    classifyStoredRefreshToken,
    hashAuthRefreshToken,
    resolveStoredRefreshTokenAction,
  } = await import(
    "../../src/shared/lib/auth-session-store"
  );
  const currentHash = hashAuthRefreshToken("current-token");
  const previousHash = hashAuthRefreshToken("previous-token");
  const olderHash = hashAuthRefreshToken("older-token");
  const now = new Date("2026-08-27T12:00:00.000Z");
  const session = {
    refreshTokenHash: currentHash,
    consumedRefreshTokenHashes: [previousHash, olderHash],
    graceRefreshTokenHashes: [previousHash],
    graceTokensValidUntil: new Date(
      now.getTime() + AUTH_REFRESH_ROTATION_GRACE_SECONDS * 1000,
    ),
  };

  assert.equal(classifyStoredRefreshToken(session, currentHash, now), "current");
  assert.equal(classifyStoredRefreshToken(session, previousHash, now), "grace");
  assert.equal(classifyStoredRefreshToken(session, olderHash, now), "reused");
  assert.equal(
    resolveStoredRefreshTokenAction(session, currentHash, now),
    "issue-current",
  );
  assert.equal(
    resolveStoredRefreshTokenAction(session, previousHash, now),
    "issue-current",
  );
  assert.equal(
    resolveStoredRefreshTokenAction(session, olderHash, now),
    "revoke",
  );
  assert.equal(
    resolveStoredRefreshTokenAction(
      session,
      hashAuthRefreshToken("unknown-token"),
      now,
    ),
    "reject",
  );
  assert.equal(
    classifyStoredRefreshToken(
      { ...session, graceTokensValidUntil: new Date(now.getTime() - 1) },
      previousHash,
      now,
    ),
    "reused",
  );
  assert.equal(
    resolveStoredRefreshTokenAction(
      { ...session, graceTokensValidUntil: new Date(now.getTime() - 1) },
      currentHash,
      now,
    ),
    "rotate",
  );
  assert.equal(
    classifyStoredRefreshToken(
      session,
      hashAuthRefreshToken("unknown-token"),
      now,
    ),
    "invalid",
  );
  assert.notEqual(currentHash, "current-token");
});

test("refresh replacement proof accepts only an active current or grace token", async () => {
  const {
    AUTH_REFRESH_ROTATION_GRACE_SECONDS,
    hashAuthRefreshToken,
    isStoredRefreshReplacementProofValid,
  } = await import("../../src/shared/lib/auth-session-store");
  const now = new Date("2026-08-27T12:00:00.000Z");
  const currentHash = hashAuthRefreshToken("current-token");
  const previousHash = hashAuthRefreshToken("previous-token");
  const olderHash = hashAuthRefreshToken("older-token");
  const session = {
    refreshTokenHash: currentHash,
    consumedRefreshTokenHashes: [previousHash, olderHash],
    graceRefreshTokenHashes: [previousHash],
    graceTokensValidUntil: new Date(
      now.getTime() + AUTH_REFRESH_ROTATION_GRACE_SECONDS * 1000,
    ),
    expiresAt: new Date(now.getTime() + 60_000),
    revokedAt: null,
  };

  assert.equal(
    isStoredRefreshReplacementProofValid(session, currentHash, now),
    true,
  );
  assert.equal(
    isStoredRefreshReplacementProofValid(session, previousHash, now),
    true,
  );
  assert.equal(
    isStoredRefreshReplacementProofValid(session, olderHash, now),
    false,
  );
  assert.equal(
    isStoredRefreshReplacementProofValid(
      { ...session, expiresAt: now },
      currentHash,
      now,
    ),
    false,
  );
  assert.equal(
    isStoredRefreshReplacementProofValid(
      { ...session, revokedAt: now },
      currentHash,
      now,
    ),
    false,
  );
});

test("a concurrent rotation wave deterministically reissues one current token", async () => {
  const {
    AUTH_REFRESH_ROTATION_GRACE_SECONDS,
    deriveStoredAuthRefreshToken,
    hashAuthRefreshToken,
    resolveStoredRefreshTokenAction,
  } = await import("../../src/shared/lib/auth-session-store");
  const sessionId = "dd5fda3e-81b0-4d88-9894-49bd0e6e8db0";
  const now = new Date("2026-08-27T12:00:00.000Z");
  const predecessor = deriveStoredAuthRefreshToken(sessionId, 0);
  const current = deriveStoredAuthRefreshToken(sessionId, 1);
  const stateAfterFirstCas = {
    refreshTokenHash: hashAuthRefreshToken(current),
    consumedRefreshTokenHashes: [hashAuthRefreshToken(predecessor)],
    graceRefreshTokenHashes: [hashAuthRefreshToken(predecessor)],
    graceTokensValidUntil: new Date(
      now.getTime() + AUTH_REFRESH_ROTATION_GRACE_SECONDS * 1000,
    ),
  };

  assert.equal(
    resolveStoredRefreshTokenAction(
      stateAfterFirstCas,
      hashAuthRefreshToken(predecessor),
      now,
    ),
    "issue-current",
  );
  assert.equal(
    resolveStoredRefreshTokenAction(
      stateAfterFirstCas,
      hashAuthRefreshToken(current),
      now,
    ),
    "issue-current",
  );
  assert.equal(deriveStoredAuthRefreshToken(sessionId, 1), current);
  assert.notEqual(deriveStoredAuthRefreshToken(sessionId, 2), current);
});

test("consumed refresh history is bounded and evicted tokens are rejected", async () => {
  const {
    AUTH_CONSUMED_REFRESH_TOKEN_HISTORY_LIMIT,
    AUTH_REFRESH_ROTATION_GRACE_SECONDS,
    appendBoundedConsumedRefreshTokenHash,
    classifyStoredRefreshToken,
    hashAuthRefreshToken,
    resolveStoredRefreshTokenAction,
  } = await import("../../src/shared/lib/auth-session-store");
  const now = new Date("2026-08-27T12:00:00.000Z");
  const existingHashes = Array.from(
    { length: AUTH_CONSUMED_REFRESH_TOKEN_HISTORY_LIMIT },
    (_, index) => hashAuthRefreshToken(`consumed-${index}`),
  );
  const presentedTokenHash = hashAuthRefreshToken("presented-current");
  const currentTokenHash = hashAuthRefreshToken("new-current");
  const boundedHashes = appendBoundedConsumedRefreshTokenHash(
    existingHashes,
    presentedTokenHash,
  );
  const session = {
    refreshTokenHash: currentTokenHash,
    consumedRefreshTokenHashes: boundedHashes,
    graceRefreshTokenHashes: [presentedTokenHash],
    graceTokensValidUntil: new Date(
      now.getTime() + AUTH_REFRESH_ROTATION_GRACE_SECONDS * 1000,
    ),
  };

  assert.equal(
    boundedHashes.length,
    AUTH_CONSUMED_REFRESH_TOKEN_HISTORY_LIMIT,
  );
  assert.equal(boundedHashes.includes(existingHashes[0]), false);
  assert.equal(boundedHashes.includes(existingHashes[1]), true);
  assert.equal(boundedHashes.at(-1), presentedTokenHash);
  assert.equal(
    classifyStoredRefreshToken(session, presentedTokenHash, now),
    "grace",
  );
  assert.equal(
    resolveStoredRefreshTokenAction(session, existingHashes[1], now),
    "revoke",
  );
  assert.equal(
    classifyStoredRefreshToken(session, existingHashes[0], now),
    "invalid",
  );
  assert.equal(
    resolveStoredRefreshTokenAction(session, existingHashes[0], now),
    "reject",
  );
  assert.deepEqual(
    appendBoundedConsumedRefreshTokenHash(
      boundedHashes,
      presentedTokenHash,
    ),
    boundedHashes,
  );
});

test("refreshing near the absolute deadline does not extend either token beyond it", async () => {
  const { env } = await import("../../src/shared/config/env");
  const {
    AUTH_REFRESH_TOKEN_MAX_AGE_SECONDS,
    setAuthSessionCookies,
  } = await import("../../src/shared/lib/auth-session");
  const startedAt =
    Math.floor(Date.now() / 1000) - AUTH_REFRESH_TOKEN_MAX_AGE_SECONDS + 3600;
  const response = setAuthSessionCookies(
    NextResponse.json({ ok: true }),
    sessionSubject,
    { refreshSessionStartedAt: startedAt },
  );
  const cookies = response.headers.getSetCookie();
  const accessCookie = cookies.find((cookie) =>
    cookie.startsWith(`${env.authCookieName}=`),
  );
  const refreshCookie = cookies.find((cookie) =>
    cookie.startsWith(`${env.authRefreshCookieName}=`),
  );

  assert.ok(accessCookie?.includes("Max-Age=3600"));
  assert.ok(refreshCookie?.includes("Max-Age=3600"));

  for (const cookie of [accessCookie, refreshCookie]) {
    assert.ok(cookie);
    const token = cookie.split("=", 2)[1].split(";", 1)[0];
    const payload = jwt.decode(token) as jwt.JwtPayload;
    assert.equal(payload.exp, startedAt + AUTH_REFRESH_TOKEN_MAX_AGE_SECONDS);
  }
});

test("session renewal rejects a foreign browser origin", async () => {
  const { assertSameOriginJsonRequest } = await import(
    "../../src/shared/lib/request-security"
  );

  assert.throws(
    () =>
      assertSameOriginJsonRequest(
        new Request("https://favor.deals/api/auth/session/refresh", {
          method: "POST",
          headers: {
            Origin: "https://attacker.example",
            "Content-Type": "application/json",
          },
        }),
      ),
    /Cross-origin requests are not allowed/,
  );
});
