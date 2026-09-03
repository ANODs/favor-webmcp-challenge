"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { authClient, sessionQueryKeys } from "@/entities/session";
import {
  FavorSubscriptionCard,
  FavorSubscriptionCheckout,
  type FavorSubscriptionTarget,
} from "@/features/favor-subscription";
import { LanguageSwitcher } from "@/features/language-switcher";
import { ProfilePrivacySettingsCard } from "@/features/profile-privacy-settings";
import { ThemePreferenceCard } from "@/features/theme-preference";
import { getUserProfileSlug } from "@/shared/lib/profile";
import { triggerTelegramNotification } from "@/shared/lib/telegram/client";
import { useThemeStore } from "@/shared/store/theme-store";
import { Button, SurfaceCard } from "@/shared/ui";

import { SettingsModerationCard } from "./settings-moderation-card";
import { SettingsOnboardingCard } from "./settings-onboarding-card";
import { SettingsSupportCard } from "./settings-support-card";
import { TonWalletWidget } from "./ton-wallet-widget";

type Props = {
  appVersion: string;
  botUsername: string;
  showModeration: boolean;
};

export function SettingsPanel({
  appVersion,
  botUsername,
  showModeration,
}: Props) {
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const [subscriptionOpen, setSubscriptionOpen] = useState(false);
  const queryClient = useQueryClient();
  const settingsT = useTranslations("Settings");
  const subscriptionT = useTranslations("FavorSubscription");
  const meQuery = useQuery({
    queryKey: sessionQueryKeys.currentUser,
    queryFn: authClient.getMe,
  });
  const me = meQuery.data;
  const subscriptionTarget: FavorSubscriptionTarget | null = me
    ? {
        id: me.id,
        slug: getUserProfileSlug(me),
        displayName:
          me.name ||
          [me.telegramFirstName, me.telegramLastName].filter(Boolean).join(" ") ||
          (me.telegramUsername ? `@${me.telegramUsername}` : null) ||
          subscriptionT("UserDefaultName"),
        isPremium: me.isPremium,
      }
    : null;

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr_1fr]">
        <div className="flex flex-col gap-4">
          <ThemePreferenceCard theme={theme} onSelectTheme={setTheme} />

          <SurfaceCard>
            <LanguageSwitcher />
          </SurfaceCard>
        </div>

        <ProfilePrivacySettingsCard
          isTelegramUsernameHidden={me?.isTelegramUsernameHidden ?? false}
          onToggleUsernameHidden={(checked) => {
            authClient
              .updateSettings({ isTelegramUsernameHidden: checked })
              .then(() =>
                queryClient.invalidateQueries({
                  queryKey: sessionQueryKeys.currentUser,
                }),
              )
              .catch(() => triggerTelegramNotification("error"));
          }}
          onSyncTelegramProfile={() => {
            const initData = window.Telegram?.WebApp?.initData?.trim();
            if (!initData) {
              triggerTelegramNotification("error");
              return;
            }
            authClient
              .syncTelegramProfile(initData)
              .then(() => {
                triggerTelegramNotification("success");
                return queryClient.invalidateQueries({
                  queryKey: sessionQueryKeys.currentUser,
                });
              })
              .catch(() => triggerTelegramNotification("error"));
          }}
        />

        {meQuery.isPending ? (
          <SurfaceCard
            className="flex min-h-64 flex-col"
            paddingClassName="p-6"
            aria-busy="true"
          >
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
              {subscriptionT("SubscriptionEyebrow")}
            </p>
            <div className="mt-4 space-y-3" aria-hidden="true">
              <div className="h-7 w-3/4 animate-pulse rounded-xl bg-[var(--surface-muted)]" />
              <div className="h-24 animate-pulse rounded-3xl bg-[var(--surface-muted)]" />
            </div>
            <p className="mt-4 text-sm text-[var(--muted-foreground)]">
              {subscriptionT("SessionLoading")}
            </p>
          </SurfaceCard>
        ) : meQuery.isError || !subscriptionTarget ? (
          <SurfaceCard
            className="flex min-h-64 flex-col"
            paddingClassName="p-6"
            role="alert"
          >
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
              {subscriptionT("SubscriptionEyebrow")}
            </p>
            <h2 className="mt-2 text-xl font-bold text-[var(--foreground)]">
              {subscriptionT("SubscriptionTitle")}
            </h2>
            <p className="mt-4 text-sm leading-6 text-[var(--muted-foreground)]">
              {subscriptionT("SessionLoadError")}
            </p>
            <Button
              type="button"
              variant="secondary"
              size="lg"
              shape="rounded-full"
              fullWidth
              className="mt-auto"
              onClick={() => void meQuery.refetch()}
            >
              {subscriptionT("RetrySession")}
            </Button>
          </SurfaceCard>
        ) : (
          <FavorSubscriptionCard
            isPremium={subscriptionTarget.isPremium}
            premiumExpiresAt={me?.premiumExpiresAt}
            onOpen={() => setSubscriptionOpen(true)}
          />
        )}

        <TonWalletWidget />
      </div>

      <div className="mt-4 grid gap-4">
        {showModeration ? <SettingsModerationCard /> : null}
        <SettingsOnboardingCard />
        <SettingsSupportCard botUsername={botUsername} />
      </div>

      <p className="mt-4 text-center text-xs text-[var(--muted-foreground)]">
        {settingsT("AppVersion")}: {" "}
        <span className="font-medium tabular-nums">{appVersion}</span>
      </p>

      {meQuery.isSuccess && subscriptionTarget ? (
        <FavorSubscriptionCheckout
          isOpen={subscriptionOpen}
          onClose={() => setSubscriptionOpen(false)}
          payerUserId={subscriptionTarget.id}
          target={subscriptionTarget}
          botUsername={botUsername}
        />
      ) : null}
    </>
  );
}
