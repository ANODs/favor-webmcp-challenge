"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { getPathname } from "@/i18n/routing";
import { withAuthSessionClientLock } from "@/shared/api";
import { resolveOnboardingEntryPath } from "@/shared/lib/onboarding";
import { resolveSafeRedirect } from "@/shared/lib/safe-redirect";
import { resolveRouteFromStartParam } from "@/shared/lib/telegram";
import type { ApiEnvelope } from "@/shared/types/api";
import type { CurrentSessionUserDto } from "@/shared/types/session-user";
import "@/shared/lib/telegram";

import { Dialog } from "./dialog";
import { SurfaceCard } from "./surface-card";
import { TurnstileWidget } from "./turnstile-widget";

const TELEGRAM_INIT_DATA_STORAGE_KEY = "favor.telegram.initData";

function resolveTelegramInitData() {
  const webAppInitData = window.Telegram?.WebApp?.initData?.trim();

  if (webAppInitData) {
    sessionStorage.setItem(TELEGRAM_INIT_DATA_STORAGE_KEY, webAppInitData);
    return webAppInitData;
  }

  const currentUrl = new URL(window.location.href);
  const hashParams = new URLSearchParams(currentUrl.hash.replace(/^#/, ""));
  const hashInitData = hashParams.get("tgWebAppData")?.trim();

  if (hashInitData) {
    sessionStorage.setItem(TELEGRAM_INIT_DATA_STORAGE_KEY, hashInitData);
    return hashInitData;
  }

  const queryInitData = currentUrl.searchParams.get("tgWebAppData")?.trim();

  if (queryInitData) {
    sessionStorage.setItem(TELEGRAM_INIT_DATA_STORAGE_KEY, queryInitData);
    return queryInitData;
  }

  const persistedInitData = sessionStorage.getItem(TELEGRAM_INIT_DATA_STORAGE_KEY)?.trim();
  return persistedInitData || "";
}

function resolvePostAuthPath(onboardingVersion: number) {
  const currentUrl = new URL(window.location.href);
  const rawRedirect = currentUrl.searchParams.get("redirect");
  const redirectPath = resolveSafeRedirect(rawRedirect);
  const startParam = resolveTelegramStartParam();
  const routeFromStartParam = resolveRouteFromStartParam(startParam);
  const destination = redirectPath ?? routeFromStartParam;

  return resolveOnboardingEntryPath({
    onboardingVersion,
    destination,
  });
}

function resolveTelegramStartParam() {
  const currentUrl = new URL(window.location.href);
  const hashParams = new URLSearchParams(currentUrl.hash.replace(/^#/, ""));

  return (
    window.Telegram?.WebApp?.initDataUnsafe?.start_param ??
    hashParams.get("tgWebAppStartParam") ??
    currentUrl.searchParams.get("tgWebAppStartParam") ??
    currentUrl.searchParams.get("startapp")
  );
}

export type AuthStatus = "pending" | "authenticating" | "done";

type PendingAuth = {
  initData: string;
  startParam: string | null | undefined;
};

export function TelegramInitAuthRedirect({
  onStatusChange,
}: {
  onStatusChange?: (status: AuthStatus) => void;
} = {}) {
  const t = useTranslations("Auth");
  const locale = useLocale();
  const hasAttemptedRef = useRef(false);
  const pendingAuthRef = useRef<PendingAuth | null>(null);
  const [challengeAction, setChallengeAction] = useState<string | null>(null);
  const [challengeError, setChallengeError] = useState("");

  const submitAuth = useCallback(
    async (pendingAuth: PendingAuth, turnstileToken?: string) => {
      try {
        await withAuthSessionClientLock(async () => {
          const response = await fetch("/api/auth/telegram", {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
              ...(turnstileToken
                ? { "X-Turnstile-Token": turnstileToken }
                : {}),
            },
            body: JSON.stringify(pendingAuth),
          });

          if (response.status === 428) {
            const payload = (await response.json().catch(() => null)) as
              | { details?: { code?: string; action?: string } }
              | null;
            if (payload?.details?.code === "CHALLENGE_REQUIRED") {
              pendingAuthRef.current = pendingAuth;
              setChallengeAction(payload.details.action ?? "telegram_auth");
              setChallengeError("");
              return;
            }
          }

          if (!response.ok) {
            throw new Error(t("telegramSessionOpenError"));
          }

          setChallengeAction(null);
          const meResponse = await fetch("/api/auth/me", {
            method: "GET",
            credentials: "include",
            cache: "no-store",
          });
          const mePayload = (await meResponse.json().catch(() => null)) as
            | ApiEnvelope<CurrentSessionUserDto | null>
            | null;

          if (!meResponse.ok || !mePayload?.ok || !mePayload.data) {
            throw new Error(t("telegramSessionVerificationError"));
          }

          const target = resolvePostAuthPath(
            mePayload.data.onboardingVersion,
          );
          window.location.replace(getPathname({ href: target, locale }));
        });
      } catch (error) {
        console.error("[tg-auth] flow failed", error);
        hasAttemptedRef.current = false;
        setChallengeAction(null);
        onStatusChange?.("done");
      }
    },
    [locale, onStatusChange, t],
  );

  useEffect(() => {
    let timeoutId: number | null = null;
    let intervalId: number | null = null;

    const tryAuthenticate = () => {
      const initData = resolveTelegramInitData();

      if (!initData || hasAttemptedRef.current) {
        return;
      }

      onStatusChange?.("authenticating");
      hasAttemptedRef.current = true;
      window.Telegram?.WebApp?.ready?.();
      const pendingAuth = { initData, startParam: resolveTelegramStartParam() };
      pendingAuthRef.current = pendingAuth;
      void submitAuth(pendingAuth);
    };

    tryAuthenticate();

    intervalId = window.setInterval(tryAuthenticate, 50);
    timeoutId = window.setTimeout(() => {
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
      if (!hasAttemptedRef.current) {
        onStatusChange?.("done");
      }
    }, 500);

    return () => {
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }

      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [onStatusChange, submitAuth]);

  return (
    <Dialog
      isOpen={Boolean(challengeAction)}
      onClose={() => undefined}
      closeOnOverlayClick={false}
      ariaLabel={t("securityChallengeTitle")}
    >
      <SurfaceCard>
        <h2 className="text-lg font-semibold text-zinc-950 dark:text-white">
          {t("securityChallengeTitle")}
        </h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {t("securityChallengeDescription")}
        </p>
        <div className="mt-5">
          {challengeAction ? (
            <TurnstileWidget
              action={challengeAction}
              onToken={(token) => {
                const pendingAuth = pendingAuthRef.current;
                if (pendingAuth) {
                  void submitAuth(pendingAuth, token);
                }
              }}
              onError={() => setChallengeError(t("securityChallengeError"))}
            />
          ) : null}
        </div>
        {challengeError ? (
          <p className="mt-3 text-sm text-red-700 dark:text-red-300">{challengeError}</p>
        ) : null}
      </SurfaceCard>
    </Dialog>
  );
}
