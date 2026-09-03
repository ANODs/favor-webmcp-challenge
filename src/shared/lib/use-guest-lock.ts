import { useState, useMemo } from "react";
import { buildTelegramMiniAppUrl, triggerTelegramImpact } from "./telegram";

type LockedAction = {
  label: string;
  startApp?: string;
};

export function useGuestLock(botUsername: string) {
  const [lockedAction, setLockedAction] = useState<LockedAction | null>(null);

  const telegramContinueUrl = useMemo(() => {
    if (!lockedAction) {
      return buildTelegramMiniAppUrl(botUsername);
    }
    return buildTelegramMiniAppUrl(botUsername, lockedAction.startApp);
  }, [botUsername, lockedAction]);

  const handleRequireAuth = (action: LockedAction) => {
    triggerTelegramImpact("light");
    setLockedAction(action);
  };

  const closeLock = () => setLockedAction(null);

  return {
    isLocked: Boolean(lockedAction),
    lockedItemLabel: lockedAction?.label ?? "",
    telegramContinueUrl,
    handleRequireAuth,
    closeLock,
  };
}
