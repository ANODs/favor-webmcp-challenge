import { env } from "@/shared/config/env";

type CookieReader = {
  get(name: string): { value: string } | undefined;
};

const AUTH_SESSION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const authSessionIdCookieName = `${env.authCookieName}_session`;

export const isAuthSessionId = (value: string): boolean =>
  AUTH_SESSION_ID_PATTERN.test(value);

export const getAuthSessionAccessCookieName = (sessionId: string) =>
  `${env.authCookieName}_access_${sessionId}`;

export const getAuthSessionRefreshCookieName = (sessionId: string) =>
  `${env.authCookieName}_refresh_${sessionId}`;

export const readActiveAuthSessionId = (
  cookieStore: CookieReader,
): string | null => {
  const value = cookieStore.get(authSessionIdCookieName)?.value;
  return value && isAuthSessionId(value) ? value : null;
};

export const hasRefreshableAuthSessionCookie = (
  cookieStore: CookieReader,
): boolean => {
  const sessionId = readActiveAuthSessionId(cookieStore);
  return sessionId
    ? Boolean(cookieStore.get(getAuthSessionRefreshCookieName(sessionId))?.value)
    : Boolean(cookieStore.get(env.authRefreshCookieName)?.value);
};
