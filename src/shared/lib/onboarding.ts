import { routing } from "@/i18n/routing";
import { routes } from "@/shared/config/routes";

import { resolveSafeRedirect } from "./safe-redirect";

export const CURRENT_ONBOARDING_VERSION = 1;
export const ONBOARDING_RETURN_TO_QUERY_PARAM = "returnTo";

const INTERNAL_URL_BASE = "https://favor.invalid";

const resolveInternalPath = (value?: string | null) => {
  const candidate = resolveSafeRedirect(value);

  if (
    !candidate ||
    /[\\\u0000-\u001f]/u.test(candidate) ||
    /%5c/iu.test(candidate)
  ) {
    return null;
  }

  try {
    const url = new URL(candidate, INTERNAL_URL_BASE);

    if (url.origin !== INTERNAL_URL_BASE) {
      return null;
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
};

const isOnboardingPath = (pathname: string) =>
  pathname === routes.onboarding || pathname.endsWith(routes.onboarding);

const removeLocalePrefix = (pathname: string) => {
  for (const locale of routing.locales) {
    const prefix = `/${locale}`;

    if (pathname === prefix) {
      return routes.home;
    }

    if (pathname.startsWith(`${prefix}/`)) {
      return pathname.slice(prefix.length);
    }
  }

  return pathname;
};

export const hasCompletedCurrentOnboarding = (onboardingVersion: number) =>
  onboardingVersion >= CURRENT_ONBOARDING_VERSION;

export const resolveOnboardingReturnTarget = (value?: string | null) => {
  const target = resolveInternalPath(value);

  if (!target) {
    return routes.feed;
  }

  const url = new URL(target, INTERNAL_URL_BASE);
  const pathname = removeLocalePrefix(url.pathname).replace(/\/$/, "");

  if (
    !pathname.startsWith("/") ||
    pathname.startsWith("//") ||
    isOnboardingPath(pathname)
  ) {
    return routes.feed;
  }

  return `${pathname || routes.home}${url.search}${url.hash}`;
};

export const buildOnboardingPath = (returnTo: string = routes.feed) => {
  const safeReturnTarget = resolveOnboardingReturnTarget(returnTo);
  const query = new URLSearchParams({
    [ONBOARDING_RETURN_TO_QUERY_PARAM]: safeReturnTarget,
  });

  return `${routes.onboarding}?${query.toString()}`;
};

export const resolveOnboardingEntryPath = ({
  onboardingVersion,
  destination,
}: {
  onboardingVersion: number;
  destination?: string | null;
}) => {
  const safeDestination = resolveOnboardingReturnTarget(destination);
  const destinationPathname = new URL(
    safeDestination,
    INTERNAL_URL_BASE,
  ).pathname.replace(/\/$/, "");

  if (
    !hasCompletedCurrentOnboarding(onboardingVersion) &&
    destinationPathname === routes.feed
  ) {
    return buildOnboardingPath(safeDestination);
  }

  return safeDestination;
};
