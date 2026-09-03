"use client";

import { BookOpenCheck, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/routing";
import { routes } from "@/shared/config/routes";
import { buildOnboardingPath } from "@/shared/lib/onboarding";
import { SurfaceCard } from "@/shared/ui";

const ONBOARDING_FROM_SETTINGS_HREF = buildOnboardingPath(routes.settings);

export function SettingsOnboardingCard() {
  const t = useTranslations("Settings");

  return (
    <SurfaceCard paddingClassName="p-2">
      <Link
        href={ONBOARDING_FROM_SETTINGS_HREF}
        className="group flex w-full items-center gap-4 rounded-[1.25rem] px-4 py-3.5 text-left outline-none transition hover:bg-[var(--background)] focus-visible:ring-2 focus-visible:ring-brand-accent-ink focus-visible:ring-offset-2"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-brand-accent">
          <BookOpenCheck className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-[var(--foreground)]">
            {t("OpenOnboarding")}
          </span>
          <span className="mt-0.5 block text-xs leading-5 text-[var(--muted-foreground)]">
            {t("OpenOnboardingDescription")}
          </span>
        </span>
        <ChevronRight
          className="h-5 w-5 shrink-0 text-[var(--muted-foreground)] opacity-50 transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </Link>
    </SurfaceCard>
  );
}
