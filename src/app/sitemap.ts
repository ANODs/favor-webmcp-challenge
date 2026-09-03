import type { MetadataRoute } from "next";

import { routes } from "@/shared/config/routes";
import { getCanonicalUrl, getLanguageAlternates } from "@/shared/lib/seo";
import { prisma } from "@/shared/lib/prisma";
import { ContractStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const locales = ["ru", "en"];

  const staticRoutesPathnames = [
    routes.home,
    routes.feed,
    routes.terms,
    routes.privacy,
  ];

  const staticRoutes: MetadataRoute.Sitemap = locales.flatMap((locale) =>
    staticRoutesPathnames.map((route) => {
      const url = getCanonicalUrl(locale, route);
      return {
        url,
        lastModified: new Date(),
        changeFrequency: "daily" as const,
        priority: route === routes.home ? 1 : 0.8,
        alternates: {
          languages: getLanguageAlternates(route),
        },
      };
    })
  );

  let contractRoutes: MetadataRoute.Sitemap = [];
  let profileRoutes: MetadataRoute.Sitemap = [];

  try {
    const contracts = await prisma.contract.findMany({
      where: {
        status: {
          in: [ContractStatus.active, ContractStatus.pending_verification],
        },
      },
      select: {
        slug: true,
        updatedAt: true,
        scoutId: true,
        author: {
          select: {
            isPremium: true,
          },
        },
      },
    });

    contractRoutes = locales.flatMap((locale) =>
      contracts.map((contract) => {
        const route = routes.contractBySlug(contract.slug);
        const url = getCanonicalUrl(locale, route);
        return {
          url,
          lastModified: contract.updatedAt,
          changeFrequency: "hourly" as const,
          priority: contract.author?.isPremium && !contract.scoutId ? 1.0 : contract.scoutId ? 0.6 : 0.8,
          alternates: {
            languages: getLanguageAlternates(route),
          },
        };
      })
    );

    const users = await prisma.user.findMany({
      select: {
        id: true,
        telegramUsername: true,
        updatedAt: true,
        isPremium: true,
      },
    });

    profileRoutes = locales.flatMap((locale) =>
      users.map((user) => {
        const normalizedUsername = user.telegramUsername?.trim().replace(/^@/, "").toLowerCase() || null;
        const profileSlug = normalizedUsername || `id-${user.id}`;
        const route = routes.profileBySlug(profileSlug);
        const url = getCanonicalUrl(locale, route);
        return {
          url,
          lastModified: user.updatedAt,
          changeFrequency: "daily" as const,
          priority: user.isPremium ? 0.9 : 0.6,
          alternates: {
            languages: getLanguageAlternates(route),
          },
        };
      })
    );
  } catch (error) {
    console.warn("Failed to fetch data for sitemap generation:", error);
  }

  return [...staticRoutes, ...contractRoutes, ...profileRoutes];
}
