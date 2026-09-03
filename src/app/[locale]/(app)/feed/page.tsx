import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { redirect } from "@/i18n/routing";
import { env } from "@/shared/config/env";
import { routes } from "@/shared/config/routes";
import { getCurrentUser } from "@/shared/lib/auth";
import {
  buildOnboardingPath,
  hasCompletedCurrentOnboarding,
} from "@/shared/lib/onboarding";
import { createWebsiteMetadata } from "@/shared/lib/seo";
import { ContractFeedView } from "@/views/contract-feed-view";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Index.PopularContracts" });

  return createWebsiteMetadata({
    locale,
    pathname: routes.feed,
    title: t("subtitle"),
    description: t("description"),
  });
}

export default async function FeedPage({ params }: Props) {
  const [{ locale }, user] = await Promise.all([params, getCurrentUser()]);

  if (user && !hasCompletedCurrentOnboarding(user.onboardingVersion)) {
    redirect({ href: buildOnboardingPath(routes.feed), locale });
  }

  return <ContractFeedView botUsername={env.telegramBotUsername} />;
}
