"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";

import { useQuery } from "@tanstack/react-query";

import { bottomNavigationItems, routes } from "@/shared/config";
import { authClient, sessionQueryKeys } from "@/entities/session";
import { useGuestLock } from "@/shared/lib/use-guest-lock";
import { getUserProfileSlug } from "@/shared/lib/profile";
import { GuestLockDialog } from "@/shared/ui";
import { useNavigationState } from "../lib/use-navigation-state";
import { NAV_ITEM_WIDTH, NAV_ITEM_HEIGHT, NAV_MOBILE_GAP, NAV_DESKTOP_GAP } from "../config/constants";
import { NavigationCaret } from "./navigation-caret";
import {
  AnimatedBriefcaseBusiness,
  AnimatedCircleUserRound,
  AnimatedPlusSquare,
  AnimatedSettings,
  AnimatedTextSearch,
} from "./animated-icons";

type Props = {
  botUsername: string;
};

type NavigationIconProps = {
  className?: string;
  isActive?: boolean;
};

const iconMap: Record<string, React.ComponentType<NavigationIconProps>> = {
  "feed": AnimatedTextSearch,
  "deals": AnimatedBriefcaseBusiness,
  "create": AnimatedPlusSquare,
  "profile": AnimatedCircleUserRound,
  "settings": AnimatedSettings,
};

export function BottomNavigation({ botUsername }: Props) {
  const t = useTranslations("Navigation");
  const { data: user } = useQuery({
    queryKey: sessionQueryKeys.currentUser,
    queryFn: authClient.getMe,
  });
  const isAuthorized = Boolean(user);

  const { isLocked, lockedItemLabel, telegramContinueUrl, handleRequireAuth, closeLock } =
    useGuestLock(botUsername);

  const { pathname, isDesktop, shouldHideNavigation, activeIndex } = useNavigationState();

  if (shouldHideNavigation) {
    return null;
  }

  return (
    <>
      <nav
        className="theme-nav fixed bottom-2 left-1/2 z-50 inline-flex w-fit -translate-x-1/2 items-center rounded-full border border-white/20 bg-white/10 p-1 backdrop-filter backdrop-blur-[30px] backdrop-invert backdrop-hue-rotate-180 backdrop-brightness-[10%] backdrop-saturate-[100] lg:sticky lg:top-6 lg:left-auto lg:mr-0 lg:mt-6 lg:translate-x-0 lg:self-start dark:border-white/10 dark:bg-white/5"
      >
        <div
          className="relative inline-flex items-center whitespace-nowrap lg:flex-col"
          style={{ gap: isDesktop ? NAV_DESKTOP_GAP : NAV_MOBILE_GAP }}
        >
          <NavigationCaret activeIndex={activeIndex} isDesktop={isDesktop} />
          {bottomNavigationItems.map((item) => {
            const Icon: React.ComponentType<NavigationIconProps> =
              iconMap[item.labelKey] || item.icon;
            const label = t(item.labelKey);
            
            // Resolve direct profile slug to prevent server redirect and utilize tanstack cache
            const resolvedHref = item.href === routes.profile && user 
              ? routes.profileBySlug(getUserProfileSlug(user)) 
              : item.href;

            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const isGuestLocked = !isAuthorized && !item.isGuestAccessible;

            return (
              <Link
                key={item.href}
                href={resolvedHref}
                title={label}
                onClick={(event) => {
                  if (!isGuestLocked) {
                    return;
                  }

                  event.preventDefault();
                  handleRequireAuth({
                    label: label,
                    startApp: item.startApp,
                  });
                }}
                className={`group relative z-10 flex flex-col gap-1 items-center justify-center transition ${isActive
                  ? "text-blue-500 dark:text-blue-400"
                  : "text-zinc-400 hover:text-zinc-200 dark:text-zinc-400 dark:hover:text-zinc-200"
                  }`}
                style={{ width: NAV_ITEM_WIDTH, height: isDesktop ? NAV_ITEM_WIDTH : NAV_ITEM_HEIGHT }}
                aria-current={isActive ? "page" : undefined}
                aria-label={label}
              >
                <Icon
                  isActive={isActive}
                  className={`h-6 w-6 ${isActive
                    ? "scale-100 text-current"
                    : "scale-95 text-current transition group-hover:scale-100"
                    }`}
                />
                <span className="text-[10px] font-medium leading-none">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <GuestLockDialog
        isOpen={isLocked}
        lockedItemLabel={lockedItemLabel}
        telegramContinueUrl={telegramContinueUrl}
        onClose={closeLock}
      />
    </>
  );
}
