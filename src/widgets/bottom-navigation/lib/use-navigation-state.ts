import { useEffect, useState } from "react";
import { routing, usePathname } from "@/i18n/routing";
import { bottomNavigationItems, routes } from "@/shared/config";

export function useNavigationState() {
  const localizedPathname = usePathname();
  const [isDesktop, setIsDesktop] = useState(false);
  const pathnameParts = localizedPathname.split("/");
  const pathname =
    routing.locales.includes(
      pathnameParts[1] as (typeof routing.locales)[number],
    )
      ? `/${pathnameParts.slice(2).join("/")}`.replace(/\/$/, "") || "/"
      : localizedPathname;

  const isCreateContractPath = pathname === routes.createContract;
  const isContractDetailsPath = /^\/contracts\/[^/]+\/?$/.test(pathname) && !isCreateContractPath;
  const isDealDetailsPath = /^\/deals\/[^/]+\/?$/.test(pathname);

  const shouldHideNavigation = isCreateContractPath || isContractDetailsPath || isDealDetailsPath;

  const activeIndex = Math.max(
    0,
    bottomNavigationItems.findIndex((item) => {
      // Prefix matching keeps nested pages, such as `/profile/some-slug`,
      // associated with their top-level navigation item.
      return pathname === item.href || pathname.startsWith(`${item.href}/`);
    }),
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const updateDesktop = () => setIsDesktop(mediaQuery.matches);

    updateDesktop();
    mediaQuery.addEventListener("change", updateDesktop);

    return () => mediaQuery.removeEventListener("change", updateDesktop);
  }, []);

  return {
    pathname,
    isDesktop,
    shouldHideNavigation,
    activeIndex,
  };
}
