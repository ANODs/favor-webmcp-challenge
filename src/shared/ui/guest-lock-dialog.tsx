"use client";

import { useTranslations } from "next-intl";

import { triggerTelegramImpact } from "@/shared/lib/telegram/client";

import { ActionCardButton } from "./action-card";
import { ActionDialog } from "./action-dialog";

type Props = {
  isOpen: boolean;
  lockedItemLabel: string;
  telegramContinueUrl: string;
  onClose: () => void;
};

export function GuestLockDialog({
  isOpen,
  lockedItemLabel,
  telegramContinueUrl,
  onClose,
}: Props) {
  const t = useTranslations("GuestLock");

  return (
    <ActionDialog
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel={t("ariaLabel", { action: lockedItemLabel })}
      actions={
        <>
          <ActionCardButton
            type="button"
            onClick={() => {
              triggerTelegramImpact("light");
              window.open(telegramContinueUrl, "_blank", "noopener,noreferrer");
            }}
          >
            {t("continueTelegram")}
          </ActionCardButton>
        </>
      }
    >
      <h2 className="text-lg font-semibold text-[var(--foreground)]">
        {t("continueAction", { action: lockedItemLabel })}
      </h2>
      <p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">
        {t("description")}
      </p>
    </ActionDialog>
  );
}
