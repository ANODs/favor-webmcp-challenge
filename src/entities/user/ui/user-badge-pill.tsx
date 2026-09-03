"use client";

import {
  Award,
  CircleHelp,
  Crown,
  Heart,
  Rocket,
  Shield,
  Sparkles,
  Star,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useLocale } from "next-intl";

import { BadgePill } from "@/shared/ui";

import type { UserBadgeDto } from "../api/user-badge-dto";

const userBadgeIcons = {
  sparkles: Sparkles,
  award: Award,
  shield: Shield,
  star: Star,
  heart: Heart,
  zap: Zap,
  rocket: Rocket,
  crown: Crown,
} satisfies Record<UserBadgeDto["iconKey"], LucideIcon>;

type Props = {
  badge: UserBadgeDto;
  tooltipFocusable?: boolean;
};

type UserBadgeIconProps = {
  iconKey: UserBadgeDto["iconKey"];
  className?: string;
};

export function UserBadgeIcon({
  iconKey,
  className = "h-3 w-3",
}: UserBadgeIconProps) {
  const Icon =
    (userBadgeIcons as Partial<Record<string, LucideIcon>>)[iconKey] ??
    CircleHelp;

  return <Icon className={className} aria-hidden="true" />;
}

export function UserBadgePill({ badge, tooltipFocusable = true }: Props) {
  const locale = useLocale();
  const label = locale === "en" ? badge.labelEn : badge.labelRu;
  const description =
    locale === "en" ? badge.descriptionEn : badge.descriptionRu;

  return (
    <BadgePill
      icon={<UserBadgeIcon iconKey={badge.iconKey} />}
      label={label}
      title={description}
      tone={badge.tone}
      tooltipFocusable={tooltipFocusable}
      className="max-sm:px-2 max-sm:text-[8px]"
    />
  );
}
