import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import createMiddleware from 'next-intl/middleware';
import { routing } from '@/i18n/routing';

import { env } from "@/shared/config/env";
import { routes } from "@/shared/config/routes";
import {
  getAuthSessionAccessCookieName,
  getAuthSessionRefreshCookieName,
  readActiveAuthSessionId,
} from "@/shared/lib/auth-session-cookie";

const handleI18nRouting = createMiddleware(routing);

export function middleware(request: NextRequest) {
  const response = handleI18nRouting(request);

  if (response.status !== 200) {
    return response;
  }
  if (env.enableDevSessionAuth) {
    console.debug("[middleware] dev session auth enabled, skipping auth check");
    return response;
  }

  const authCookieName = env.authCookieName;
  const { pathname } = request.nextUrl;
  const pathWithoutLocale = pathname.replace(/^\/(ru|en)/, '') || '/';
  
  const isProtectedContractRoute =
    /^\/contracts\/[^/]+\/edit$/.test(pathWithoutLocale);
  const isProtectedRoute =
    isProtectedContractRoute ||
    pathWithoutLocale.startsWith(routes.deals) ||
    pathWithoutLocale.startsWith(routes.settings) ||
    pathWithoutLocale.startsWith(routes.moderation);

  if (!isProtectedRoute) {
    return response;
  }

  const activeSessionId = readActiveAuthSessionId(request.cookies);
  const token = request.cookies.get(
    activeSessionId
      ? getAuthSessionAccessCookieName(activeSessionId)
      : authCookieName,
  )?.value;
  const refreshToken = request.cookies.get(
    activeSessionId
      ? getAuthSessionRefreshCookieName(activeSessionId)
      : env.authRefreshCookieName,
  )?.value;
  console.debug("[middleware] protected route check", {
    pathname: request.nextUrl.pathname,
    authCookieName,
    hasToken: Boolean(token),
    hasRefreshToken: Boolean(refreshToken),
  });

  if (!token && !refreshToken) {
    const url = request.nextUrl.clone();
    url.pathname = `/${routing.defaultLocale}${routes.home}`; // Or keep current locale
    // Better to just set pathWithoutLocale to home, but since it's a redirect, we need the locale
    const locale = pathname.match(/^\/(ru|en)/)?.[0] || `/${routing.defaultLocale}`;
    url.pathname = `${locale}${routes.home}`;
    url.searchParams.set("auth", "required");
    url.searchParams.set(
      "redirect",
      `${request.nextUrl.pathname}${request.nextUrl.search}${request.nextUrl.hash}`,
    );

    console.warn("[middleware] redirecting to home because auth cookie is missing", {
      from: pathname,
      to: url.pathname,
    });

    return NextResponse.redirect(url);
  }

  console.debug("[middleware] auth cookie found, allowing request", {
    pathname: request.nextUrl.pathname,
  });
  return response;
}

export const config = {
  matcher: [
    '/',
    '/(ru|en)/:path*',
    '/((?!api|_next|_vercel|.*\\..*).*)'
  ],
};
