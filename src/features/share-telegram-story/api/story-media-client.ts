import { getTelegramWebApp } from "@/shared/lib/telegram";
import {
  DiagnosticError,
  recordDiagnosticBreadcrumb,
} from "@/shared/lib/client-diagnostics";

type StoryMediaUploadResponse = {
  url: string;
  expiresAt: string;
};

type StoryMediaUploadEnvelope = {
  ok: true;
  data: StoryMediaUploadResponse;
};

export const storyMediaClient = {
  async upload(video: Blob, variant: string): Promise<StoryMediaUploadResponse> {
    const initData = getTelegramWebApp()?.initData;
    if (!initData) {
      throw new DiagnosticError(
        "STORY_TELEGRAM_CONTEXT_MISSING",
        "Telegram initData is unavailable",
      );
    }

    recordDiagnosticBreadcrumb({
      category: "story",
      name: "upload",
      outcome: "started",
      metadata: { variant, bytes: video.size },
    });

    let response: Response;
    try {
      response = await fetch("/api/telegram/story-media", {
        method: "POST",
        headers: {
          "Content-Type": "video/mp4",
          "X-Telegram-Init-Data": initData,
          "X-Story-Variant": variant,
        },
        body: video,
      });
    } catch (error) {
      recordDiagnosticBreadcrumb({
        category: "story",
        name: "upload",
        outcome: "failure",
        metadata: { reason: "network" },
      });
      throw new DiagnosticError("STORY_UPLOAD_NETWORK_FAILED", "Story upload failed", {
        cause: error,
        metadata: { variant, bytes: video.size },
      });
    }

    if (!response.ok) {
      recordDiagnosticBreadcrumb({
        category: "story",
        name: "upload",
        outcome: "failure",
        metadata: { status: response.status },
      });
      throw new DiagnosticError(
        "STORY_UPLOAD_FAILED",
        `Story media upload failed with ${response.status}`,
        { metadata: { status: response.status, variant, bytes: video.size } },
      );
    }

    const payload = (await response.json()) as StoryMediaUploadEnvelope;
    recordDiagnosticBreadcrumb({
      category: "story",
      name: "upload",
      outcome: "success",
      metadata: { status: response.status },
    });
    return payload.data;
  },
};
