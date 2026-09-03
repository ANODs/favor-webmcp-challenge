"use client";

import { useLocale, useTranslations } from "next-intl";
import { Unbounded } from "next/font/google";

const unbounded = Unbounded({ subsets: ["latin", "cyrillic"] });

import { buildProfileShareText, type UserProfileDto } from "@/entities/user";
import { TelegramStoryShareButton } from "@/features/share-telegram-story";
import { RatingStars, SurfaceCard, UserAvatar } from "@/shared/ui";

import { ProfileBadges } from "./profile-badges";

type Props = {
  profile: UserProfileDto;
  displayName: string;
  isOwnProfile: boolean;
  profileShareUrl: string | null;
  profileBadgeState: {
    isFavorPremium: boolean;
    isTelegramPremium: boolean;
    telegramLevel?: number | null;
    badges: UserProfileDto["user"]["badges"];
  };
  onFavorPlusClick?: () => void;
};

export function ProfileSummaryBlock({
  profile,
  displayName,
  isOwnProfile,
  profileShareUrl,
  profileBadgeState,
  onFavorPlusClick,
}: Props) {
  const t = useTranslations("Profile");
  const locale = useLocale() as "ru" | "en";

  return (
    <SurfaceCard paddingClassName="p-4 sm:p-6">
      <div className="relative flex min-w-0 items-start gap-3 sm:gap-4">
        <UserAvatar
          key={profile.user.avatarUrl ?? "fallback"}
          avatarUrl={profile.user.avatarUrl}
          displayName={displayName}
          className="h-16 w-16 sm:h-20 sm:w-20 md:h-24 md:w-24"
          fallbackClassName="text-xl sm:text-2xl"
          sizes="(min-width: 768px) 96px, (min-width: 640px) 80px, 64px"
        />
        <div className="min-w-0 flex-1 pr-11 sm:pr-0">
          <p className="hidden truncate text-sm text-zinc-500 sm:block">
            favor.deals/profile/{profile.user.profileSlug}
          </p>
          <h1
            className={`truncate text-2xl font-extrabold tracking-tight text-zinc-950 sm:mt-2 sm:text-3xl ${unbounded.className}`}
          >
            {displayName}
          </h1>
          <p className="mt-1 truncate text-sm text-zinc-600 sm:mt-2">
            @{profile.user.telegramUsername ?? t("NoUsernameFallback")}
          </p>
          <div className="hidden sm:block">
            <ProfileBadges
              isFavorPremium={profileBadgeState.isFavorPremium}
              isTelegramPremium={profileBadgeState.isTelegramPremium}
              telegramLevel={profileBadgeState.telegramLevel}
              badges={profileBadgeState.badges}
              onFavorPlusClick={onFavorPlusClick}
            />
          </div>
        </div>

        <div className="absolute right-0 top-0 flex shrink-0 items-center gap-2 sm:static">
          {!isOwnProfile && profile.user.telegramUsername ? (
            <a
              href={`https://t.me/${profile.user.telegramUsername.replace(/^@/, "")}`}
              target="_blank"
              rel="noreferrer"
              className="hidden h-10 items-center justify-center rounded-full bg-zinc-950 px-4 text-sm font-medium !text-white transition hover:bg-zinc-800 sm:inline-flex"
            >
              {t("GoToChat")}
            </a>
          ) : null}
          {profileShareUrl ? (
            <TelegramStoryShareButton
              url={profileShareUrl}
              text={buildProfileShareText(
                {
                  displayName,
                  telegramUsername: profile.user.telegramUsername,
                  rating: profile.user.rating,
                  completedDealsCount: profile.completedDealsCount,
                  contractsCount: profile.contractsCount,
                  profileSlug: profile.user.profileSlug,
                },
                locale,
              )}
              preparedMessage={{ type: "profile", slug: profile.user.profileSlug }}
              story={{
                type: "profile",
                url: profileShareUrl,
                displayName,
                telegramUsername: profile.user.telegramUsername,
                avatarUrl: profile.user.avatarUrl,
                rating: profile.user.rating ?? 0,
                completedDealsCount: profile.completedDealsCount,
                contractsCount: profile.contractsCount,
              }}
            />
          ) : null}
        </div>
      </div>

      <div className="sm:hidden">
        <ProfileBadges
          isFavorPremium={profileBadgeState.isFavorPremium}
          isTelegramPremium={profileBadgeState.isTelegramPremium}
          telegramLevel={profileBadgeState.telegramLevel}
          badges={profileBadgeState.badges}
          onFavorPlusClick={onFavorPlusClick}
        />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 sm:mt-6 sm:gap-4">
        <div className="min-w-0 rounded-2xl bg-zinc-50 px-2.5 py-3 sm:rounded-3xl sm:p-4">
          <p className="min-h-6 text-[9px] leading-3 uppercase tracking-normal text-zinc-500 sm:min-h-0 sm:text-xs sm:leading-normal sm:tracking-wide">
            {t("Rating")}
          </p>
          <div className="mt-1.5 hidden sm:block">
            <RatingStars value={profile.user.rating} emptyLabel={t("NoRating")} />
          </div>
          <div className="mt-1.5 sm:hidden">
            <RatingStars
              value={profile.user.rating}
              variant="compact"
              emptyLabel={t("NoRating")}
            />
          </div>
        </div>
        <Metric
          title={isOwnProfile ? t("MyDeals") : t("AuthorDeals")}
          value={String(profile.completedDealsCount)}
        />
        <Metric
          title={isOwnProfile ? t("MyContracts") : t("AuthorContracts")}
          value={String(profile.contractsCount)}
        />
      </div>

      <div className="mt-6 hidden gap-3 text-sm text-zinc-600 md:grid md:grid-cols-3">
        <ProfileLine label={t("NameLabel")} value={displayName} />
        <ProfileLine
          label="Telegram"
          value={profile.user.telegramUsername ? `@${profile.user.telegramUsername}` : t("NotSpecified")}
        />
      </div>
    </SurfaceCard>
  );
}

function ProfileLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-zinc-50 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 font-medium text-zinc-900">{value}</p>
    </div>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-zinc-50 px-2.5 py-3 sm:rounded-3xl sm:p-4">
      <p className="min-h-6 text-[9px] leading-3 uppercase tracking-normal text-zinc-500 sm:min-h-0 sm:text-xs sm:leading-normal sm:tracking-wide">
        {title}
      </p>
      <p className="mt-1.5 text-base font-semibold text-zinc-900 sm:mt-2 sm:text-lg">{value}</p>
    </div>
  );
}
