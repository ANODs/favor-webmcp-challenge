"use client";

import { useTranslations } from "next-intl";

import { Link } from "@/i18n/routing";
import { routes } from "@/shared/config/routes";

type Props = {
  className?: string;
  compact?: boolean;
};

export function HomePrimaryActions({ className = "", compact = false }: Props) {
  const t = useTranslations("Index.Hero");

  return (
    <div
      className={`${
        compact
          ? "grid grid-cols-2 gap-2"
          : "flex flex-col gap-3 sm:flex-row sm:flex-wrap"
      } ${className}`}
    >
      <Link
        href={routes.createContract}
        className={`inline-flex items-center justify-center rounded-2xl bg-brand-accent font-bold !text-black transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black ${
          compact
            ? "min-h-12 px-3 text-center text-[11px] leading-4 sm:px-4 sm:text-xs lg:min-h-14 lg:px-5 lg:text-sm"
            : "min-h-[3.75rem] px-6 text-sm sm:px-7 sm:text-base"
        }`}
      >
        {t("createContract")}
      </Link>

      <Link
        href={routes.feed}
        className={`inline-flex items-center justify-center rounded-2xl border border-white/25 bg-black/35 font-bold !text-white backdrop-blur-sm transition hover:border-white/55 hover:bg-white/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
          compact
            ? "min-h-12 px-3 text-center text-[11px] leading-4 sm:px-4 sm:text-xs lg:min-h-14 lg:px-5 lg:text-sm"
            : "min-h-[3.75rem] px-6 text-sm sm:px-7 sm:text-base"
        }`}
      >
        {t("viewContracts")}
      </Link>
    </div>
  );
}
