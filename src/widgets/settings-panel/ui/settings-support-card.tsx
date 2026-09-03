"use client";

import { ChevronRight, MessageCircleWarning } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  buildReportStartParam,
  buildTelegramBotStartUrl,
  openTelegramLink,
} from "@/shared/lib/telegram";
import { SurfaceCard } from "@/shared/ui/surface-card";

type Props = {
  botUsername: string;
};

export function SettingsSupportCard({ botUsername }: Props) {
  const t = useTranslations("Settings");

  const handleReportProblem = () => {
    openTelegramLink(
      buildTelegramBotStartUrl(botUsername, buildReportStartParam()),
    );
  };

  return (
    <SurfaceCard paddingClassName="p-2">
      <button
        type="button"
        onClick={handleReportProblem}
        className="group flex w-full items-center gap-4 rounded-[1.25rem] px-4 py-3.5 text-left outline-none transition hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:hover:bg-white/5"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400">
          <MessageCircleWarning className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-zinc-950">
            {t("ReportProblem")}
          </span>
          <span className="mt-0.5 block text-xs leading-5 text-zinc-500">
            {t("ReportProblemDescription")}
          </span>
        </span>
        <ChevronRight
          className="h-5 w-5 shrink-0 text-zinc-300 transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </button>
    </SurfaceCard>
  );
}
