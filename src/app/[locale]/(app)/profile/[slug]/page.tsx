import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { env } from "@/shared/config/env";
import { routes } from "@/shared/config/routes";
import { prisma } from "@/shared/lib/prisma";
import { getCanonicalUrl, getLanguageAlternates } from "@/shared/lib/seo";
import { ProfileView } from "@/views/profile-view";
import { parseUserProfileSlug } from "@/shared/lib/profile";
import { buildTelegramAvatarProxyUrl } from "@/shared/lib/telegram/avatar";

type Props = {
  params: Promise<{
    slug: string;
    locale: string;
  }>;
};

export async function generateStaticParams() {
  if (!process.env.DATABASE_URL) {
    return [];
  }

  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        telegramUsername: true,
      },
    });

    return users.map((user) => {
      const normalizedUsername = user.telegramUsername?.trim().replace(/^@/, "").toLowerCase() || null;
      const profileSlug = normalizedUsername || `id-${user.id}`;
      return { slug: profileSlug };
    });
  } catch (error) {
    // Graceful fallback for Docker build without database access
    console.warn("Failed to fetch users for static generation, falling back to on-demand ISR:", error);
    return [];
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, locale } = await params;
  const pathname = routes.profileBySlug(slug);
  const canonicalUrl = getCanonicalUrl(locale, pathname);
  const translationsPromise = getTranslations({
    locale,
    namespace: "Metadata.Profile",
  });

  try {
    const parsedSlug = parseUserProfileSlug(slug);

    const whereCondition = parsedSlug.id
      ? { id: parsedSlug.id }
      : { telegramUsername: { equals: parsedSlug.telegramUsername as string, mode: "insensitive" as const } };

    const [user, t] = await Promise.all([
      prisma.user.findFirst({
        where: whereCondition,
        select: {
          id: true,
          telegramId: true,
          name: true,
          telegramFirstName: true,
          telegramUsername: true,
          isTelegramUsernameHidden: true,
        },
      }),
      translationsPromise,
    ]);

    if (!user) {
      return {
        title: t("NotFoundTitle"),
        description: t("NotFoundDescription"),
        robots: { index: false, follow: false },
      };
    }

    const completedDeals = await prisma.deal.count({
      where: {
        status: "completed",
        OR: [{ customerId: user.id }, { freelancerId: user.id }],
      },
    });

    const displayName = user.name || user.telegramFirstName || t("UserFallback");
    const displayUsername = user.telegramUsername && !user.isTelegramUsernameHidden ? `@${user.telegramUsername}` : "";
    const title = t("Title", {
      name: `${displayName}${displayUsername ? ` (${displayUsername})` : ""}`,
    });
    const description =
      completedDeals > 0
        ? t("DescriptionWithDeals", { name: displayName, count: completedDeals })
        : t("Description", { name: displayName });

    const coverImage = new URL(
      buildTelegramAvatarProxyUrl(user.telegramId),
      env.baseUrl,
    ).toString();

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
        type: "profile",
        url: canonicalUrl,
        images: [coverImage],
      },
      twitter: {
        card: "summary",
        title,
        description,
        images: [coverImage],
      },
    };
  } catch (error) {
    console.error("Failed to generate metadata for profile:", error);
    // Graceful fallback to prevent 500 Internal Server Error page if DB is down or times out
    const t = await translationsPromise;

    return {
      title: t("FallbackTitle"),
      description: t("FallbackDescription"),
      alternates: {
        canonical: canonicalUrl,
      },
    };
  }
}


export default async function ProfileBySlugPage({ params }: Props) {
  const { slug } = await params;

  return <ProfileView botUsername={env.telegramBotUsername} profileSlug={slug} />;
}
