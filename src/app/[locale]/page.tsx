import type { Metadata } from "next";
import { connection } from "next/server";

import { redirect } from "@/i18n/routing";
import { routes } from "@/shared/config/routes";
import { siteConfig } from "@/shared/config/site";
import { getCurrentUser } from "@/shared/lib/auth";
import { resolveOnboardingEntryPath } from "@/shared/lib/onboarding";
import { resolveSafeRedirect } from "@/shared/lib/safe-redirect";
import { createWebsiteMetadata, getCanonicalUrl, getSiteBaseUrl } from "@/shared/lib/seo";
import { resolveRouteFromStartParam } from "@/shared/lib/telegram";

import { getTranslations } from "next-intl/server";
import { HomeView, getPopularContracts, getPlatformStats } from "@/views/home-view";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata.Home" });

  return createWebsiteMetadata({
    locale,
    pathname: routes.home,
    title: t("title"),
    description: t("description"),
  });
}

type HomeProps = {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Home({ params, searchParams }: HomeProps) {
  const { locale } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const rawRedirect =
    typeof resolvedSearchParams?.redirect === "string"
      ? resolvedSearchParams.redirect
      : undefined;
  const redirectTarget = resolveSafeRedirect(rawRedirect);
  const startParam =
    typeof resolvedSearchParams?.tgWebAppStartParam === "string"
      ? resolvedSearchParams.tgWebAppStartParam
      : typeof resolvedSearchParams?.startapp === "string"
        ? resolvedSearchParams.startapp
        : undefined;
  const startParamTarget = resolveRouteFromStartParam(startParam);
  const user = await getCurrentUser();

  if (user) {
    const destination = redirectTarget ?? startParamTarget;

    redirect({
      href: resolveOnboardingEntryPath({
        onboardingVersion: user.onboardingVersion,
        destination,
      }),
      locale,
    });
  }

  await connection();
  const [popularContracts, platformStats] = await Promise.all([
    getPopularContracts(),
    getPlatformStats(),
  ]);
  const t = await getTranslations({ locale, namespace: "Metadata.Home" });
  const baseUrl = getSiteBaseUrl();
  const canonicalUrl = getCanonicalUrl(locale, routes.home);
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${baseUrl}/#organization`,
        name: siteConfig.name,
        url: baseUrl,
        logo: `${baseUrl}/logo.svg`,
        sameAs: [
          siteConfig.links.telegram,
          siteConfig.links.channel,
          siteConfig.links.twitter,
          siteConfig.links.youtube,
        ],
      },
      {
        "@type": "WebSite",
        "@id": `${baseUrl}/#website`,
        url: baseUrl,
        name: siteConfig.name,
        publisher: {
          "@id": `${baseUrl}/#organization`,
        },
        inLanguage: locale,
      },
      {
        "@type": "WebPage",
        "@id": `${canonicalUrl}#webpage`,
        url: canonicalUrl,
        name: t("title"),
        description: t("description"),
        isPartOf: {
          "@id": `${baseUrl}/#website`,
        },
        about: {
          "@id": `${baseUrl}/#organization`,
        },
        inLanguage: locale,
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <HomeView
        popularContracts={popularContracts}
        platformStats={platformStats}
      />
    </>
  );
}
