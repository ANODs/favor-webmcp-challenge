"use client";

import { useQuery } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { authClient, sessionQueryKeys } from "@/entities/session";

export function AccountRestrictionBanner() {
  const t = useTranslations("AccountRestrictions");
  const format = useFormatter();
  const meQuery = useQuery({
    queryKey: sessionQueryKeys.currentUser,
    queryFn: authClient.getMe,
  });
  const restriction = meQuery.data?.accountRestrictions?.[0];

  if (!restriction) {
    return null;
  }

  const expiresAt = restriction.expiresAt
    ? format.dateTime(new Date(restriction.expiresAt), {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : t("duration.permanent");

  return (
    <div className="mx-4 mt-4 flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-950 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-100">
      <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <p className="text-sm font-semibold">
          {t(`scopeRestricted.${restriction.scope}`)}
        </p>
        <p className="mt-1 text-sm text-red-800 dark:text-red-200">
          {restriction.publicMessage}
        </p>
        <p className="mt-1 text-xs text-red-700/80 dark:text-red-300/80">
          {t("expiresAt", { value: expiresAt })}
        </p>
      </div>
    </div>
  );
}
