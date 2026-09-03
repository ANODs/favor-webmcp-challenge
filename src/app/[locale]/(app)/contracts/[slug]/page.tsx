import { cache } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import {
  buildContractOgImagePath,
  resolveLocalizedContractContent,
} from "@/entities/contract";
import { env } from "@/shared/config/env";
import { routes } from "@/shared/config/routes";
import { siteConfig } from "@/shared/config/site";
import { prisma } from "@/shared/lib/prisma";
import {
  absoluteUrl,
  getCanonicalUrl,
  getLanguageAlternates,
  getOpenGraphLocale,
  getSiteBaseUrl,
  serializeJsonLd,
} from "@/shared/lib/seo";
import {
  CONTRACT_DEAL_INTENT_QUERY_PARAM,
  CONTRACT_DEAL_INTENT_QUERY_VALUE,
} from "@/shared/lib/telegram";
import { ContractDetailsView } from "@/views/contract-details-view";

type Props = {
  params: Promise<{
    slug: string;
    locale: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const getContractForSeo = cache(async (slug: string) => {
  return prisma.contract.findUnique({
    where: { slug },
    select: {
      titleRu: true,
      titleEn: true,
      descriptionRu: true,
      descriptionEn: true,
      mediaRefs: true,
      ogImageBase64: true,
      updatedAt: true,
      createdAt: true,
      basePrice: true,
      type: true,
      status: true,
      scoutId: true,
      author: {
        select: {
          isPremium: true,
          name: true,
          telegramFirstName: true,
        },
      },
    },
  });
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, locale } = await params;
  const [contract, t] = await Promise.all([
    getContractForSeo(slug),
    getTranslations({ locale, namespace: "Metadata.Contract" }),
  ]);

  if (!contract) {
    return {
      title: t("NotFoundTitle"),
      description: t("NotFoundDescription"),
      robots: { index: false, follow: false },
    };
  }

  const isIndexable =
    contract.status === "active" ||
    contract.status === "pending_verification";

  const fallbackTitle = contract.titleRu || contract.titleEn || "Favor";
  const localizedContent = resolveLocalizedContractContent(
    contract,
    locale === "en" ? "en" : "ru",
    fallbackTitle,
    t("FallbackDescription", { title: fallbackTitle }),
  );
  const rawTitle = localizedContent.title;
  const rawDescription = localizedContent.description;

  const title = rawTitle;
  const socialTitle = `${rawTitle} | Favor`;

  const budgetSuffix = contract.basePrice
    ? ` ${t("Budget", { price: contract.basePrice.toString() })}`
    : "";
  const normalizedDescription = rawDescription.replace(/\s+/g, " ").trim();
  const descriptionLimit = Math.max(80, 155 - budgetSuffix.length);
  const truncatedDescription = normalizedDescription.slice(0, descriptionLimit);
  const description = `${truncatedDescription}${normalizedDescription.length > descriptionLimit ? "…" : ""}${budgetSuffix}`;

  const coverImage = Array.isArray(contract.mediaRefs)
    ? (contract.mediaRefs[0] as string)
    : undefined;

  const generatedOgImageUrl = buildContractOgImagePath({
    slug,
    locale: locale === "en" ? "en" : "ru",
    updatedAt: contract.updatedAt,
  });
  const rawOgImageUrl =
    contract.ogImageBase64 || contract.author?.isPremium || !coverImage
      ? generatedOgImageUrl
      : coverImage;
  const ogImageUrl = rawOgImageUrl ? absoluteUrl(rawOgImageUrl) : undefined;

  const pathname = routes.contractBySlug(slug);
  const canonicalUrl = getCanonicalUrl(locale, pathname);

  return {
    title,
    description,
    robots: isIndexable ? undefined : { index: false, follow: false },
    alternates: {
      canonical: canonicalUrl,
      languages: getLanguageAlternates(pathname),
    },
    openGraph: {
      title: socialTitle,
      description,
      type: "article",
      url: canonicalUrl,
      siteName: siteConfig.name,
      locale: getOpenGraphLocale(locale),
      publishedTime: contract.createdAt.toISOString(),
      modifiedTime: contract.updatedAt.toISOString(),
      images: ogImageUrl ? [ogImageUrl] : [],
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
      images: ogImageUrl ? [ogImageUrl] : [],
    },
  };
}

export default async function ContractDetailsPage({
  params,
  searchParams,
}: Props) {
  const [{ slug, locale }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams,
  ]);
  const dealIntent =
    resolvedSearchParams[CONTRACT_DEAL_INTENT_QUERY_PARAM] ===
    CONTRACT_DEAL_INTENT_QUERY_VALUE;

  const contract = await getContractForSeo(slug);

  let jsonLd = null;

  if (
    contract?.author?.isPremium &&
    !contract.scoutId &&
    contract.type === "order"
  ) {
    const fallbackTitle = contract.titleRu || contract.titleEn || "Favor";
    const localizedContent = resolveLocalizedContractContent(
      contract,
      locale === "en" ? "en" : "ru",
      fallbackTitle,
    );
    const rawTitle = localizedContent.title;
    const rawDescription = localizedContent.description;
    const authorName =
      contract.author.name ||
      contract.author.telegramFirstName ||
      "Favor User";
    const baseUrl = getSiteBaseUrl();

    jsonLd = {
      "@context": "https://schema.org/",
      "@type": "JobPosting",
      title: rawTitle,
      description: rawDescription,
      datePosted: contract.createdAt.toISOString(),
      employmentType: "CONTRACTOR",
      hiringOrganization: {
        "@type": "Organization",
        name: authorName,
        sameAs: baseUrl,
        logo: `${baseUrl}/logo.svg`,
      },
      jobLocationType: "TELECOMMUTE",
      applicantLocationRequirements: {
        "@type": "Country",
        name: "Worldwide",
      },
      ...(contract.basePrice
        ? {
            baseSalary: {
              "@type": "MonetaryAmount",
              currency: "USD",
              value: {
                "@type": "QuantitativeValue",
                value: Number(contract.basePrice),
                unitText: "TASK",
              },
            },
          }
        : {}),
    };
  }

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
        />
      )}
      <ContractDetailsView
        slug={slug}
        botUsername={env.telegramBotUsername}
        dealIntent={dealIntent}
      />
    </>
  );
}
