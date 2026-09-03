"use client";

import { useTranslations } from "next-intl";
import { ActionCard, ActionCardButton, ActionCardInset } from "@/shared/ui/action-card";

type Props = {
  isTelegramUsernameHidden: boolean;
  onToggleUsernameHidden: (checked: boolean) => void;
  onSyncTelegramProfile: () => void;
};

export function ProfilePrivacySettingsCard({
  isTelegramUsernameHidden,
  onToggleUsernameHidden,
  onSyncTelegramProfile,
}: Props) {
  const t = useTranslations("Settings");

  return (
    <ActionCard title={t("PrivacyData")} bodyClassName="mt-4 flex flex-1 flex-col gap-4">
      <ActionCardInset className="flex cursor-pointer items-center justify-between gap-4 p-4 transition hover:bg-zinc-100">
        <label className="flex w-full cursor-pointer items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-zinc-900">{t("HideUsername")}</p>
            <p className="mt-1 text-xs text-zinc-600">
              {t("HideUsernameDescription")}
            </p>
          </div>
          <input
            type="checkbox"
            className="h-5 w-5 cursor-pointer rounded border-zinc-300 text-zinc-950 focus:ring-zinc-950"
            checked={isTelegramUsernameHidden}
            onChange={(event) => onToggleUsernameHidden(event.target.checked)}
          />
        </label>
      </ActionCardInset>

      <ActionCardButton
        type="button"
        onClick={onSyncTelegramProfile}
        className="mt-auto"
      >
        {t("UpdateTelegramProfile")}
      </ActionCardButton>
    </ActionCard>
  );
}
