"use client";

type TelegramHapticImpactStyle = "light" | "medium" | "heavy" | "rigid" | "soft";
type TelegramHapticNotificationType = "error" | "success" | "warning";
type TelegramInvoiceStatus = "paid" | "cancelled" | "failed" | "pending";
type TelegramWriteAccessRequestedEvent = {
  status: "allowed" | "cancelled";
};

type TelegramWriteAccessRequestedEventHandler = (
  event: TelegramWriteAccessRequestedEvent,
) => void;

export type TelegramWebAppUser = {
  id: number;
  is_bot?: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: true;
  added_to_attachment_menu?: true;
  allows_write_to_pm?: true;
  photo_url?: string;
};

export type TelegramWriteAccessRequestResult =
  | "allowed"
  | "denied"
  | "unavailable";

const TELEGRAM_MOBILE_STORY_PLATFORMS = new Set(["android", "android_x", "ios"]);
const TELEGRAM_WRITE_ACCESS_MIN_VERSION = "6.9";
const TELEGRAM_WRITE_ACCESS_REQUEST_TIMEOUT_MS = 30_000;

let telegramWriteAccessGrantedForUserId: number | null = null;
let telegramWriteAccessDeniedForUserId: number | null = null;
let pendingTelegramWriteAccessRequest: Promise<TelegramWriteAccessRequestResult> | null =
  null;

export type TelegramStoryShareParams = {
  text?: string;
  widget_link?: {
    url: string;
    name?: string;
  };
};

type TelegramWebApp = {
  platform?: string;
  version?: string;
  colorScheme?: "light" | "dark";
  initData?: string;
  initDataUnsafe?: {
    user?: TelegramWebAppUser;
    start_param?: string;
  };
  ready?: () => void;
  BackButton?: {
    show: () => void;
    hide: () => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
  };
  SettingsButton?: {
    show: () => void;
    hide: () => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
  };
  HapticFeedback?: {
    impactOccurred: (style: TelegramHapticImpactStyle) => void;
    notificationOccurred: (type: TelegramHapticNotificationType) => void;
    selectionChanged: () => void;
  };
  openTelegramLink?: (url: string) => void;
  openInvoice?: (url: string, callback?: (status: TelegramInvoiceStatus) => void) => void;
  shareMessage?: (messageId: string, callback?: (sent: boolean) => void) => void;
  shareToStory?: (mediaUrl: string, params?: TelegramStoryShareParams) => void;
  requestWriteAccess?: (callback?: (allowed: boolean) => void) => void;
  onEvent?: (
    eventType: "writeAccessRequested",
    callback: TelegramWriteAccessRequestedEventHandler,
  ) => void;
  offEvent?: (
    eventType: "writeAccessRequested",
    callback: TelegramWriteAccessRequestedEventHandler,
  ) => void;
  isVersionAtLeast?: (version: string) => boolean;
};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

export function getTelegramWebApp() {
  if (typeof window === "undefined") return undefined;
  return window.Telegram?.WebApp;
}

export function hasTelegramWriteAccess() {
  const user = getTelegramWebApp()?.initDataUnsafe?.user;

  if (!user || telegramWriteAccessDeniedForUserId === user.id) {
    return false;
  }

  return (
    user?.allows_write_to_pm === true ||
    telegramWriteAccessGrantedForUserId === user.id
  );
}

const normalizeTelegramWriteAccessResult = (
  value: unknown,
): Exclude<TelegramWriteAccessRequestResult, "unavailable"> | null => {
  if (
    value === true ||
    (value !== null &&
      typeof value === "object" &&
      "status" in value &&
      value.status === "allowed")
  ) {
    return "allowed";
  }

  if (
    value === false ||
    (value !== null &&
      typeof value === "object" &&
      "status" in value &&
      value.status === "cancelled")
  ) {
    return "denied";
  }

  return null;
};

const requestTelegramWriteAccessOnce = (
  webApp: TelegramWebApp,
): Promise<TelegramWriteAccessRequestResult> =>
  new Promise((resolve) => {
    let isSettled = false;
    let isEventSubscribed = false;

    const handleEvent: TelegramWriteAccessRequestedEventHandler = (event) => {
      const result = normalizeTelegramWriteAccessResult(event);
      if (result) {
        settle(result);
      }
    };

    const cleanup = () => {
      clearTimeout(timeoutId);

      if (isEventSubscribed) {
        try {
          webApp.offEvent?.("writeAccessRequested", handleEvent);
        } catch {
          // Telegram owns this bridge. A cleanup failure must not change the result.
        }
      }
    };

    const settle = (result: TelegramWriteAccessRequestResult) => {
      if (isSettled) {
        return;
      }

      isSettled = true;

      const telegramUserId = webApp.initDataUnsafe?.user?.id ?? null;

      if (result === "allowed") {
        telegramWriteAccessGrantedForUserId = telegramUserId;

        if (telegramWriteAccessDeniedForUserId === telegramUserId) {
          telegramWriteAccessDeniedForUserId = null;
        }
      } else if (result === "denied") {
        telegramWriteAccessGrantedForUserId = null;
        telegramWriteAccessDeniedForUserId = telegramUserId;
      }

      cleanup();
      resolve(result);
    };

    const timeoutId = setTimeout(
      () => settle("unavailable"),
      TELEGRAM_WRITE_ACCESS_REQUEST_TIMEOUT_MS,
    );

    if (webApp.onEvent && webApp.offEvent) {
      isEventSubscribed = true;

      try {
        webApp.onEvent("writeAccessRequested", handleEvent);
      } catch {
        isEventSubscribed = false;
        // The callback form below remains available on supported clients.
      }
    }

    if (isSettled) {
      return;
    }

    try {
      webApp.requestWriteAccess?.((allowed) => {
        const result = normalizeTelegramWriteAccessResult(allowed);
        if (result) {
          settle(result);
        }
      });
    } catch {
      settle("unavailable");
    }
  });

export function requestTelegramWriteAccess(
  { force = false }: { force?: boolean } = {},
): Promise<TelegramWriteAccessRequestResult> {
  const webApp = getTelegramWebApp();

  if (!force && hasTelegramWriteAccess()) {
    return Promise.resolve("allowed");
  }

  if (force) {
    telegramWriteAccessGrantedForUserId = null;
    telegramWriteAccessDeniedForUserId =
      webApp?.initDataUnsafe?.user?.id ?? null;
  }

  if (!webApp?.requestWriteAccess) {
    return Promise.resolve("unavailable");
  }

  if (webApp.isVersionAtLeast) {
    try {
      if (!webApp.isVersionAtLeast(TELEGRAM_WRITE_ACCESS_MIN_VERSION)) {
        return Promise.resolve("unavailable");
      }
    } catch {
      return Promise.resolve("unavailable");
    }
  }

  if (pendingTelegramWriteAccessRequest) {
    return pendingTelegramWriteAccessRequest;
  }

  const request = requestTelegramWriteAccessOnce(webApp);
  const trackedRequest = request.finally(() => {
    if (pendingTelegramWriteAccessRequest === trackedRequest) {
      pendingTelegramWriteAccessRequest = null;
    }
  });

  pendingTelegramWriteAccessRequest = trackedRequest;
  return trackedRequest;
}

export function triggerTelegramImpact(style: TelegramHapticImpactStyle = "light") {
  getTelegramWebApp()?.HapticFeedback?.impactOccurred(style);
}

export function triggerTelegramSelectionChanged() {
  getTelegramWebApp()?.HapticFeedback?.selectionChanged();
}

export function triggerTelegramNotification(type: TelegramHapticNotificationType) {
  getTelegramWebApp()?.HapticFeedback?.notificationOccurred(type);
}

export function openTelegramShare(url: string, text?: string) {
  const shareUrl = new URL("https://t.me/share/url");
  shareUrl.searchParams.set("url", url);

  if (text?.trim()) {
    shareUrl.searchParams.set("text", text.trim());
  }

  const targetUrl = shareUrl.toString();
  openTelegramLink(targetUrl);
}

export function openTelegramLink(url: string) {
  const webApp = getTelegramWebApp();

  if (webApp?.openTelegramLink) {
    webApp.openTelegramLink(url);
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
}

export function sharePreparedTelegramMessage(messageId: string) {
  const webApp = getTelegramWebApp();

  if (!webApp?.shareMessage) {
    return false;
  }

  webApp.shareMessage(messageId);
  return true;
}

export function canShareToTelegramStory() {
  const webApp = getTelegramWebApp();
  return Boolean(
    isTelegramMobileStoryPlatform(webApp?.platform) &&
      webApp?.initData &&
      webApp.shareToStory &&
      (!webApp.isVersionAtLeast || webApp.isVersionAtLeast("7.8")),
  );
}

export function isTelegramMobileStoryPlatform(platform?: string) {
  return platform ? TELEGRAM_MOBILE_STORY_PLATFORMS.has(platform.toLowerCase()) : false;
}

export function isTelegramStoryPlatformSupported() {
  return isTelegramMobileStoryPlatform(getTelegramWebApp()?.platform);
}

export function shareToTelegramStory(mediaUrl: string, params?: TelegramStoryShareParams) {
  const webApp = getTelegramWebApp();
  if (!webApp?.shareToStory) return false;
  webApp.shareToStory(mediaUrl, params);
  return true;
}

export function openTelegramInvoice(
  url: string,
  callback?: (status: TelegramInvoiceStatus) => void,
) {
  const webApp = getTelegramWebApp();

  if (webApp?.openInvoice) {
    webApp.openInvoice(url, callback);
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
}
