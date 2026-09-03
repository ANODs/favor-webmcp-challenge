import { useTranslations } from "next-intl";
import type { UserBadgeDto } from "@/entities/user";
import { UserBadgePill } from "@/entities/user/ui";
import { BadgePill, Button, FavorPlusLogo, TelegramLogo } from "@/shared/ui";

type ProfileBadgesProps = {
  isFavorPremium: boolean;
  isTelegramPremium: boolean;
  telegramLevel: number | null | undefined;
  badges: UserBadgeDto[];
  onFavorPlusClick?: () => void;
};

export function ProfileBadges({
  isFavorPremium,
  isTelegramPremium,
  telegramLevel,
  badges,
  onFavorPlusClick,
}: ProfileBadgesProps) {
  const t = useTranslations("Profile");

  const hasTelegramLevel = typeof telegramLevel === "number" && telegramLevel > 0;

  if (
    !isFavorPremium &&
    !isTelegramPremium &&
    !hasTelegramLevel &&
    badges.length === 0
  ) {
    return null;
  }

  return (
    <div className="mt-3 flex flex-wrap gap-1.5 sm:mt-4 sm:gap-2">
      {isFavorPremium ? (
        onFavorPlusClick ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            shape="rounded-full"
            className="-my-2 min-h-11 p-0"
            aria-label={t("OpenFavorPlusBenefits")}
            onClick={onFavorPlusClick}
          >
            <FavorBadge
              title={t("PremiumFavorBadge")}
              tooltipFocusable={false}
            />
          </Button>
        ) : (
          <FavorBadge title={t("PremiumFavorBadge")} />
        )
      ) : null}
      {isTelegramPremium ? (
        <BadgePill
          icon={<TelegramLogo size={12} />}
          label="Telegram Premium"
          title={t("PremiumTelegramBadge")}
          tone="brand-blue"
          className="max-sm:px-2 max-sm:text-[8px]"
        />
      ) : null}
      {hasTelegramLevel ? (
        <BadgePill
          icon={<TelegramLevelBadgeIcon />}
          label={`TG Level ${telegramLevel}`}
          title={t("TelegramLevelBadge")}
          tone="brand-pink"
          className="max-sm:px-2 max-sm:text-[8px]"
        />
      ) : null}
      {badges.map((badge) => (
        <UserBadgePill key={badge.id} badge={badge} />
      ))}
    </div>
  );
}

function FavorBadge({
  title,
  tooltipFocusable = true,
}: {
  title: string;
  tooltipFocusable?: boolean;
}) {
  return (
    <BadgePill
      icon={
        <FavorPlusLogo
          size={12}
          fill="currentColor"
          className="!drop-shadow-none"
        />
      }
      label="Favor Plus"
      title={title}
      tone="brand-accent"
      tooltipFocusable={tooltipFocusable}
      className="max-sm:px-2 max-sm:text-[8px]"
    />
  );
}



function TelegramLevelBadgeIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true" className="shrink-0">
      <path
        d="M7 1.5L8.56 3.35L10.95 3.05L10.65 5.44L12.5 7L10.65 8.56L10.95 10.95L8.56 10.65L7 12.5L5.44 10.65L3.05 10.95L3.35 8.56L1.5 7L3.35 5.44L3.05 3.05L5.44 3.35L7 1.5Z"
        fill="currentColor"
        fillOpacity="0.2"
      />
      <path
        d="M7.6 3.4L5.15 7.02H6.76L6.18 10.6L8.85 6.93H7.22L7.6 3.4Z"
        fill="currentColor"
      />
    </svg>
  );
}
