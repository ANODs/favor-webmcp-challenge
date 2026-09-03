import type { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import jwt, { type JwtPayload } from "jsonwebtoken";

import { env } from "@/shared/config/env";
import {
  authSessionIdCookieName,
  getAuthSessionAccessCookieName,
  getAuthSessionRefreshCookieName,
  isAuthSessionId,
} from "@/shared/lib/auth-session-cookie";

export const AUTH_ACCESS_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
export const AUTH_REFRESH_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export type AuthSessionSubject = {
  userId: number;
  role: Role;
  telegramId: string;
};

export type AuthRefreshSession = AuthSessionSubject & {
  sessionStartedAt: number;
};

export type AuthAccessSession = AuthSessionSubject & {
  sessionId?: string;
};

export type StoredAuthAccessSession = AuthSessionSubject & {
  sessionId: string;
};

export type AuthSessionCookieIssue = {
  sessionId: string;
  refreshToken: string;
  startedAt: Date;
  expiresAt: Date;
};

type AuthTokenKind = "access" | "refresh";

const baseCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

const isRole = (value: unknown): value is Role =>
  typeof value === "string" && Object.values(Role).includes(value as Role);

const parseAuthTokenSubject = (
  value: string | JwtPayload,
): AuthAccessSession => {
  if (
    typeof value === "string" ||
    !Number.isSafeInteger(value.userId) ||
    (value.userId as number) < 0 ||
    !isRole(value.role) ||
    typeof value.telegramId !== "string" ||
    !/^\d+$/.test(value.telegramId) ||
    (value.sessionId !== undefined &&
      (typeof value.sessionId !== "string" ||
        !isAuthSessionId(value.sessionId)))
  ) {
    throw new Error("Invalid authentication token payload.");
  }

  const subject: AuthAccessSession = {
    userId: value.userId as number,
    role: value.role,
    telegramId: value.telegramId,
  };

  if (typeof value.sessionId === "string") {
    subject.sessionId = value.sessionId;
  }

  return subject;
};

const signToken = (
  payload: AuthSessionSubject,
  tokenKind: AuthTokenKind,
  expiresInSeconds: number,
  sessionId?: string,
) =>
  jwt.sign({ ...payload, tokenKind, sessionId }, env.jwtSecret, {
    algorithm: "HS256",
    expiresIn: expiresInSeconds,
  });

export const signAuthToken = (
  payload: AuthSessionSubject,
  maxAgeSeconds = AUTH_ACCESS_TOKEN_MAX_AGE_SECONDS,
  sessionId?: string,
) => signToken(payload, "access", maxAgeSeconds, sessionId);

export const signAuthRefreshToken = (
  payload: AuthSessionSubject,
  sessionStartedAt = Math.floor(Date.now() / 1000),
) =>
  jwt.sign(
    {
      ...payload,
      tokenKind: "refresh",
      sessionStartedAt,
      exp: sessionStartedAt + AUTH_REFRESH_TOKEN_MAX_AGE_SECONDS,
    },
    env.jwtSecret,
    { algorithm: "HS256" },
  );

const verifyToken = (token: string) =>
  jwt.verify(token, env.jwtSecret, { algorithms: ["HS256"] });

export const verifyStoredAuthToken = (
  token: string,
  expectedSessionId: string,
): StoredAuthAccessSession => {
  const verified = verifyToken(token);
  const subject = parseAuthTokenSubject(verified);

  if (
    typeof verified === "string" ||
    verified.tokenKind !== "access" ||
    subject.sessionId !== expectedSessionId
  ) {
    throw new Error("Invalid stored authentication token payload.");
  }

  return { ...subject, sessionId: expectedSessionId };
};

export const verifyDevAuthToken = (token: string): AuthSessionSubject => {
  const verified = verifyToken(token);
  const subject = parseAuthTokenSubject(verified);

  if (
    typeof verified === "string" ||
    verified.tokenKind !== "access" ||
    subject.sessionId !== undefined
  ) {
    throw new Error("Invalid development authentication token payload.");
  }

  return subject;
};

export const verifyLegacyAuthToken = (token: string) => {
  const verified = verifyToken(token);

  if (
    typeof verified === "string" ||
    verified.tokenKind != null ||
    verified.sessionId != null
  ) {
    throw new Error("Expected a legacy authentication token.");
  }

  return parseAuthTokenSubject(verified);
};

export const verifyAuthRefreshToken = (token: string): AuthRefreshSession => {
  const verified = verifyToken(token);
  const subject = parseAuthTokenSubject(verified);

  if (
    typeof verified === "string" ||
    verified.tokenKind !== "refresh" ||
    subject.sessionId !== undefined
  ) {
    throw new Error("Invalid refresh token payload.");
  }

  const sessionStartedAt = Number.isSafeInteger(verified.sessionStartedAt)
    ? (verified.sessionStartedAt as number)
    : Number.isSafeInteger(verified.iat)
      ? (verified.iat as number)
      : null;

  if (!sessionStartedAt || sessionStartedAt > Math.floor(Date.now() / 1000) + 60) {
    throw new Error("Invalid refresh session start time.");
  }

  return { ...subject, sessionStartedAt };
};

export const setAuthSessionCookies = (
  response: NextResponse,
  payload: AuthSessionSubject,
  options: { refreshSessionStartedAt?: number } = {},
) => {
  const now = Math.floor(Date.now() / 1000);
  const refreshSessionStartedAt = options.refreshSessionStartedAt ?? now;
  const refreshMaxAge = Math.max(
    0,
    refreshSessionStartedAt + AUTH_REFRESH_TOKEN_MAX_AGE_SECONDS - now,
  );
  const accessMaxAge = Math.min(
    AUTH_ACCESS_TOKEN_MAX_AGE_SECONDS,
    refreshMaxAge,
  );

  response.cookies.set(env.authCookieName, signAuthToken(payload, accessMaxAge), {
    ...baseCookieOptions,
    maxAge: accessMaxAge,
  });
  response.cookies.set(
    env.authRefreshCookieName,
    signAuthRefreshToken(payload, refreshSessionStartedAt),
    {
      ...baseCookieOptions,
      maxAge: refreshMaxAge,
    },
  );
  response.cookies.set(authSessionIdCookieName, "", {
    ...baseCookieOptions,
    maxAge: 0,
  });

  return response;
};

export const setStoredAuthSessionCookies = (
  response: NextResponse,
  payload: AuthSessionSubject,
  issue: AuthSessionCookieIssue,
  options: { activateSession: boolean; replacedSessionId?: string | null },
) => {
  if (!isAuthSessionId(issue.sessionId)) {
    throw new Error("Invalid authentication session id.");
  }

  const now = Math.floor(Date.now() / 1000);
  const sessionExpiresAt = Math.floor(issue.expiresAt.getTime() / 1000);
  const refreshMaxAge = Math.max(0, sessionExpiresAt - now);
  const accessMaxAge = Math.min(
    AUTH_ACCESS_TOKEN_MAX_AGE_SECONDS,
    refreshMaxAge,
  );

  response.cookies.set(
    getAuthSessionAccessCookieName(issue.sessionId),
    signAuthToken(payload, accessMaxAge, issue.sessionId),
    {
      ...baseCookieOptions,
      maxAge: accessMaxAge,
    },
  );
  response.cookies.set(
    getAuthSessionRefreshCookieName(issue.sessionId),
    issue.refreshToken,
    {
      ...baseCookieOptions,
      maxAge: refreshMaxAge,
    },
  );

  if (options.activateSession) {
    response.cookies.set(authSessionIdCookieName, issue.sessionId, {
      ...baseCookieOptions,
      maxAge: refreshMaxAge,
    });
    response.cookies.set(env.authCookieName, "", {
      ...baseCookieOptions,
      maxAge: 0,
    });
    response.cookies.set(env.authRefreshCookieName, "", {
      ...baseCookieOptions,
      maxAge: 0,
    });

    if (
      options.replacedSessionId &&
      options.replacedSessionId !== issue.sessionId &&
      isAuthSessionId(options.replacedSessionId)
    ) {
      response.cookies.set(
        getAuthSessionAccessCookieName(options.replacedSessionId),
        "",
        { ...baseCookieOptions, maxAge: 0 },
      );
      response.cookies.set(
        getAuthSessionRefreshCookieName(options.replacedSessionId),
        "",
        { ...baseCookieOptions, maxAge: 0 },
      );
    }
  }

  return response;
};

export const clearAuthSessionCookies = (
  response: NextResponse,
  options: { sessionId?: string | null; clearActiveSession?: boolean } = {},
) => {
  response.cookies.set(env.authCookieName, "", {
    ...baseCookieOptions,
    maxAge: 0,
  });
  response.cookies.set(env.authRefreshCookieName, "", {
    ...baseCookieOptions,
    maxAge: 0,
  });

  if (options.sessionId && isAuthSessionId(options.sessionId)) {
    response.cookies.set(
      getAuthSessionAccessCookieName(options.sessionId),
      "",
      {
        ...baseCookieOptions,
        maxAge: 0,
      },
    );
    response.cookies.set(
      getAuthSessionRefreshCookieName(options.sessionId),
      "",
      {
        ...baseCookieOptions,
        maxAge: 0,
      },
    );
  }

  if (options.clearActiveSession !== false) {
    response.cookies.set(authSessionIdCookieName, "", {
      ...baseCookieOptions,
      maxAge: 0,
    });
  }

  return response;
};
