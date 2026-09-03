import { redirect } from "@/i18n/routing";
import { routes } from "@/shared/config/routes";
import { getCurrentUser } from "@/shared/lib/auth";
import {
  hasCompletedCurrentOnboarding,
  ONBOARDING_RETURN_TO_QUERY_PARAM,
  resolveOnboardingReturnTarget,
} from "@/shared/lib/onboarding";
import { OnboardingView } from "@/views/onboarding-view";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function OnboardingPage({ params, searchParams }: Props) {
  const [{ locale }, currentUser, resolvedSearchParams] = await Promise.all([
    params,
    getCurrentUser(),
    searchParams,
  ]);

  if (!currentUser) {
    return redirect({ href: routes.home, locale });
  }

  const rawReturnTo =
    resolvedSearchParams[ONBOARDING_RETURN_TO_QUERY_PARAM];
  const returnTo = resolveOnboardingReturnTarget(
    typeof rawReturnTo === "string" ? rawReturnTo : rawReturnTo?.[0],
  );

  return (
    <OnboardingView
      requiresCompletion={
        !hasCompletedCurrentOnboarding(currentUser.onboardingVersion)
      }
      returnTo={returnTo}
    />
  );
}
