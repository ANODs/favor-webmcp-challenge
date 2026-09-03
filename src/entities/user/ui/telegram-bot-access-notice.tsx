"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import {
  buildTelegramBotStartUrl,
  openTelegramLink,
  requestTelegramWriteAccess,
  type TelegramWriteAccessRequestResult,
} from "@/shared/lib/telegram";
import { Button } from "@/shared/ui";

type TelegramBotAccessNoticeProps = {
  botUsername: string;
  onAccessGranted?: () => void | Promise<void>;
  onPendingChange?: (isPending: boolean) => void;
};

export function TelegramBotAccessNotice({
  botUsername,
  onAccessGranted,
  onPendingChange,
}: TelegramBotAccessNoticeProps) {
  const t = useTranslations("TelegramBotAccess");
  const [isRequesting, setIsRequesting] = useState(false);
  const [requestResult, setRequestResult] =
    useState<TelegramWriteAccessRequestResult | null>(null);

  const handleRequestAccess = async () => {
    setIsRequesting(true);
    onPendingChange?.(true);
    setRequestResult(null);

    try {
      const result = await requestTelegramWriteAccess({ force: true });

      if (result === "allowed") {
        await onAccessGranted?.();
        return;
      }

      setRequestResult(result);
    } finally {
      setIsRequesting(false);
      onPendingChange?.(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p>{t("Description")}</p>
        <p className="text-xs leading-5">{t("OpenBotHint")}</p>
        {requestResult ? (
          <p className="text-xs font-medium" role="status">
            {requestResult === "denied"
              ? t("AccessDenied")
              : t("AccessUnavailable")}
          </p>
        ) : null}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          type="button"
          onClick={() => void handleRequestAccess()}
          loading={isRequesting}
          variant="secondary"
          shape="rounded-xl"
          size="sm"
          fullWidth
          className="!border-current !text-current"
        >
          {isRequesting ? t("RequestingAccess") : t("RequestAccess")}
        </Button>
        <Button
          type="button"
          onClick={() =>
            openTelegramLink(
              buildTelegramBotStartUrl(botUsername, "notifications"),
            )
          }
          variant="secondary"
          shape="rounded-xl"
          size="sm"
          fullWidth
          className="!border-current !text-current"
        >
          {t("OpenBot")}
        </Button>
      </div>
    </div>
  );
}
