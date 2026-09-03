import { BriefcaseBusiness, CircleUserRound, Gavel, PlusSquare, Settings, TextSearch } from "lucide-react";

import { routes } from "@/shared/config/routes";
import { TELEGRAM_MINI_APP_START_PARAMS } from "@/shared/lib/telegram";

export const bottomNavigationItems = [
  {
    href: routes.feed,
    labelKey: "feed",
    icon: TextSearch,
    isGuestAccessible: true,
  },
  {
    href: routes.deals,
    labelKey: "deals",
    icon: BriefcaseBusiness,
    startApp: TELEGRAM_MINI_APP_START_PARAMS.deals,
  },
  {
    href: routes.createContract,
    labelKey: "create",
    icon: PlusSquare,
    startApp: TELEGRAM_MINI_APP_START_PARAMS.create,
    isGuestAccessible: true,
  },
  {
    href: routes.profile,
    labelKey: "profile",
    icon: CircleUserRound,
    startApp: TELEGRAM_MINI_APP_START_PARAMS.profile,
  },
  {
    href: routes.settings,
    labelKey: "settings",
    icon: Settings,
    startApp: TELEGRAM_MINI_APP_START_PARAMS.settings,
  },
];

export const moderatorNavigationItem = {
  href: routes.moderation,
  labelKey: "moderation",
  icon: Gavel,
};
