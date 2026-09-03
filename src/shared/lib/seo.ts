import type { Metadata } from "next";

import { routing } from "@/i18n/routing";
import { env } from "@/shared/config/env";
import { siteConfig } from "@/shared/config/site";

type AppLocale = (typeof routing.locales)[number];

const defaultBaseUrl = "https://favor.deals";

export const getSiteBaseUrl = () => (env.baseUrl || defaultBaseUrl).replace(/\/+$/, "");

export const normalizeLocale = (locale: string): AppLocale =>
  routing.locales.includes(locale as AppLocale) ? (locale as AppLocale) : routing.defaultLocale;

const normalizePathname = (pathname: string) => {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;

  if (path === "/") {
    return "";
  }

  return path.replace(/\/+$/, "");
};

export const getLocalizedPathname = (locale: string, pathname = "/") =>
  `/${normalizeLocale(locale)}${normalizePathname(pathname)}`;

export const absoluteUrl = (pathOrUrl: string) => {
  if (/^(https?:)?\/\//.test(pathOrUrl) || pathOrUrl.startsWith("data:")) {
    return pathOrUrl;
  }

  const pathname = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${getSiteBaseUrl()}${pathname}`;
};

export const getCanonicalUrl = (locale: string, pathname = "/") =>
  absoluteUrl(getLocalizedPathname(locale, pathname));

export const getLanguageAlternates = (pathname = "/") => {
  const languages: Record<string, string> = {};

  for (const locale of routing.locales) {
    languages[locale] = getCanonicalUrl(locale, pathname);
  }

  languages["x-default"] = getCanonicalUrl(routing.defaultLocale, pathname);

  return languages;
};

export const getOpenGraphLocale = (locale: string) => (normalizeLocale(locale) === "ru" ? "ru_RU" : "en_US");

export const getDefaultOgImage = (locale: string) => absoluteUrl(`/images/og-${normalizeLocale(locale)}.png`);

export const serializeJsonLd = (value: unknown) =>
  JSON.stringify(value).replace(/</g, "\\u003c");

export const createWebsiteMetadata = ({
  locale,
  pathname = "/",
  title,
  description,
}: {
  locale: string;
  pathname?: string;
  title: string;
  description: string;
}): Metadata => {
  const canonicalUrl = getCanonicalUrl(locale, pathname);
  const imageUrl = getDefaultOgImage(locale);

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
      languages: getLanguageAlternates(pathname),
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: siteConfig.name,
      type: "website",
      locale: getOpenGraphLocale(locale),
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
};
