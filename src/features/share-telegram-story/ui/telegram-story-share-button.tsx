"use client";

import type { ComponentProps } from "react";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useLocale, useTranslations } from "next-intl";

import {
  canShareToTelegramStory,
  buildReferralStartParam,
  buildTelegramMiniAppUrl,
  isTelegramStoryPlatformSupported,
  parseReferralTelegramId,
  shareToTelegramStory,
} from "@/shared/lib/telegram";
import {
  DiagnosticError,
  recordDiagnosticBreadcrumb,
  reportRecoverableError,
} from "@/shared/lib/client-diagnostics";
import { TelegramShareIconButton } from "@/shared/ui";

import { storyMediaClient } from "../api/story-media-client";
import {
  canGenerateTelegramStoryVideo,
  generateTelegramStoryVideo,
} from "../lib/generate-story-video";
import { getTelegramStoryShareParams } from "../lib/story-copy";
import type { TelegramStoryProgress, TelegramStoryTarget } from "../model/types";

type Props = Omit<ComponentProps<typeof TelegramShareIconButton>, "storyShare"> & {
  story: TelegramStoryTarget;
};

const toDisplayProgress = (progress: TelegramStoryProgress) => {
  if (progress.phase === "audio") return progress.value * 0.04;
  if (progress.phase === "render") return 0.04 + progress.value * 0.9;
  return 0.94 + progress.value * 0.06;
};

const subscribeToClientRuntime = () => () => undefined;
type StoryAvailability = "hidden" | "unavailable" | "available";
const getStoryAvailability = (): StoryAvailability => {
  if (!isTelegramStoryPlatformSupported()) return "hidden";
  return canShareToTelegramStory() && canGenerateTelegramStoryVideo()
    ? "available"
    : "unavailable";
};
const getServerStoryAvailability = (): StoryAvailability => "hidden";

const getReferralFollowUp = (story: TelegramStoryTarget): TelegramStoryTarget | null => {
  if (story.type === "referral") return null;
  try {
    const storyUrl = new URL(story.url);
    const telegramId = parseReferralTelegramId(storyUrl.searchParams.get("startapp"));
    const botUsername = storyUrl.pathname.split("/").filter(Boolean)[0];
    if (!telegramId || !botUsername) return null;
    return {
      type: "referral",
      url: buildTelegramMiniAppUrl(botUsername, buildReferralStartParam(telegramId)),
    };
  } catch {
    return null;
  }
};

export function TelegramStoryShareButton({ story, ...shareProps }: Props) {
  const locale = useLocale() === "en" ? "en" : "ru";
  const t = useTranslations("ShareMenu");
  const storyAvailability = useSyncExternalStore(
    subscribeToClientRuntime,
    getStoryAvailability,
    getServerStoryAvailability,
  );

  const shareStory = useCallback(
    async (target: TelegramStoryTarget, onProgress: (value: number) => void) => {
      const video = await generateTelegramStoryVideo(target, locale, (progress) => {
        onProgress(toDisplayProgress(progress));
      });
      onProgress(toDisplayProgress({ phase: "upload", value: 0 }));
      const media = await storyMediaClient.upload(video, target.type);
      onProgress(1);

      const shared = shareToTelegramStory(
        media.url,
        getTelegramStoryShareParams(target, locale),
      );
      if (!shared) {
        throw new DiagnosticError(
          "STORY_TELEGRAM_SHARE_FAILED",
          "Telegram shareToStory is unavailable",
          { metadata: { target: target.type } },
        );
      }
      recordDiagnosticBreadcrumb({
        category: "story",
        name: "telegram-share",
        outcome: "success",
        metadata: { target: target.type },
      });
    },
    [locale],
  );
  const handleShareStory = useCallback(
    (onProgress: (value: number) => void) => shareStory(story, onProgress),
    [shareStory, story],
  );
  const referralFollowUp = useMemo(() => getReferralFollowUp(story), [story]);
  const handleReferralFollowUp = useCallback(
    (onProgress: (value: number) => void) => {
      if (!referralFollowUp) return Promise.reject(new Error("Referral story is unavailable"));
      return shareStory(referralFollowUp, onProgress);
    },
    [referralFollowUp, shareStory],
  );
  const handleStoryError = useCallback(
    (error: unknown, retry: () => Promise<void>) => {
      reportRecoverableError(error, {
        code: "STORY_SHARE_FAILED",
        area: "telegram-story",
        title: t("storyErrorTitle"),
        description: t("storyErrorDescription"),
        metadata: { target: story.type },
        retry,
      });
    },
    [story.type, t],
  );

  return (
    <TelegramShareIconButton
      {...shareProps}
      storyShare={
        storyAvailability === "hidden"
          ? undefined
          : {
              available: storyAvailability === "available",
              onShare: handleShareStory,
              onError: handleStoryError,
              ...(referralFollowUp
                ? {
                    followUp: {
                      title: t("shareReferralStory"),
                      description: t("shareReferralStoryDescription"),
                      onShare: handleReferralFollowUp,
                    },
                  }
                : {}),
            }
      }
    />
  );
}
