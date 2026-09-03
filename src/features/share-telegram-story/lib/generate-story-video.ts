import type {
  TelegramStoryLocale,
  TelegramStoryProgress,
  TelegramStoryTarget,
} from "../model/types";
import {
  DiagnosticError,
  recordDiagnosticBreadcrumb,
} from "@/shared/lib/client-diagnostics";

import { referralStoryContextClient } from "../api/referral-story-context-client";

import { resolveTelegramStoryTheme } from "./story-theme";

type WorkerProgressMessage = {
  type: "progress";
  frame: number;
  frameCount: number;
};

type WorkerDoneMessage = {
  type: "done";
  buffer: ArrayBuffer;
};

type WorkerErrorMessage = {
  type: "error";
  code: string;
  stage: string;
  frame?: number;
  message: string;
  stack?: string;
};

type StoryWorkerMessage = WorkerProgressMessage | WorkerDoneMessage | WorkerErrorMessage;

const audioByTarget = {
  contract: "/audio/stories/contract.mp3",
  profile: "/audio/stories/profile.mp3",
  referral: "/audio/stories/referral.mp3",
} as const;
const STORY_AUDIO_GAIN = 1.15;
let storyCapabilityCache: boolean | null = null;

const applyStoryAudioGain = (sample: number) =>
  Math.max(-1, Math.min(1, sample * STORY_AUDIO_GAIN));

const getResolvedStoryTheme = () =>
  resolveTelegramStoryTheme(
    document.documentElement.dataset.theme,
    window.matchMedia("(prefers-color-scheme: dark)").matches,
  );

const makeAbsoluteUrl = (value?: string | null) => {
  if (!value) return null;
  if (value.includes("telegram.org") || value.includes("t.me")) {
    return new URL(
      `/api/telegram/proxy-image?url=${encodeURIComponent(value)}`,
      window.location.origin,
    ).toString();
  }
  return new URL(value, window.location.origin).toString();
};

const resolveTargetAssets = (target: TelegramStoryTarget): TelegramStoryTarget => {
  if (target.type === "contract") {
    return { ...target, imageUrl: makeAbsoluteUrl(target.imageUrl) };
  }
  if (target.type === "profile") {
    return { ...target, avatarUrl: makeAbsoluteUrl(target.avatarUrl) };
  }
  return target;
};

const resolveTargetContext = async (
  target: TelegramStoryTarget,
): Promise<TelegramStoryTarget> => {
  if (target.type !== "referral" || target.stats) return target;

  try {
    return {
      ...target,
      stats: await referralStoryContextClient.loadStats(),
    };
  } catch (error) {
    throw new DiagnosticError(
      "STORY_CONTEXT_LOAD_FAILED",
      error instanceof Error ? error.message : "Story context could not be loaded",
      { cause: error, metadata: { target: target.type } },
    );
  }
};

const decodeAudio = async (url: string) => {
  let response: Response;
  try {
    response = await fetch(url);
  } catch (error) {
    throw new DiagnosticError("STORY_AUDIO_LOAD_FAILED", "Story audio could not be loaded", {
      cause: error,
    });
  }
  if (!response.ok) {
    throw new DiagnosticError("STORY_AUDIO_LOAD_FAILED", "Story audio could not be loaded", {
      metadata: { status: response.status },
    });
  }

  const audioContext = new AudioContext();
  try {
    const decoded = await audioContext.decodeAudioData(await response.arrayBuffer());
    const channels = Array.from(
      { length: decoded.numberOfChannels },
      (_, index) => Float32Array.from(decoded.getChannelData(index), applyStoryAudioGain),
    );
    return {
      channels,
      sampleRate: decoded.sampleRate,
      length: decoded.length,
    };
  } catch (error) {
    throw new DiagnosticError("STORY_AUDIO_DECODE_FAILED", "Story audio could not be decoded", {
      cause: error,
    });
  } finally {
    await audioContext.close();
  }
};

export const canGenerateTelegramStoryVideo = () => {
  if (storyCapabilityCache !== null) return storyCapabilityCache;

  storyCapabilityCache =
    typeof Worker !== "undefined" &&
    typeof OffscreenCanvas !== "undefined" &&
    typeof VideoEncoder !== "undefined" &&
    typeof AudioEncoder !== "undefined";

  if (!storyCapabilityCache) return false;

  try {
    const canvas = new OffscreenCanvas(1, 1);
    const context = canvas.getContext("webgl2");
    storyCapabilityCache = Boolean(context);
    context?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    storyCapabilityCache = false;
  }

  return storyCapabilityCache;
};

export const generateTelegramStoryVideo = async (
  target: TelegramStoryTarget,
  locale: TelegramStoryLocale,
  onProgress: (progress: TelegramStoryProgress) => void,
) => {
  if (!canGenerateTelegramStoryVideo()) {
    throw new DiagnosticError(
      "STORY_RENDERING_UNAVAILABLE",
      "WebCodecs or worker WebGL2 is unavailable",
    );
  }

  recordDiagnosticBreadcrumb({
    category: "story",
    name: "generate",
    outcome: "started",
    metadata: { target: target.type, locale },
  });
  onProgress({ phase: "audio", value: 0 });
  const [audio, resolvedTarget] = await Promise.all([
    decodeAudio(audioByTarget[target.type]),
    resolveTargetContext(target),
  ]);
  onProgress({ phase: "audio", value: 1 });

  return new Promise<Blob>((resolve, reject) => {
    const worker = new Worker("/workers/story-video.worker.mjs", {
      type: "module",
      name: "favor-story-video",
    });
    const cleanup = () => worker.terminate();
    let lastProgressBucket = -1;

    worker.onerror = (event) => {
      cleanup();
      reject(
        new DiagnosticError(
          "STORY_WORKER_CRASHED",
          event.message || "Story worker failed",
          { metadata: { filename: event.filename || null, line: event.lineno || null } },
        ),
      );
    };
    worker.onmessage = (event: MessageEvent<StoryWorkerMessage>) => {
      if (event.data.type === "progress") {
        const bucket = Math.floor((event.data.frame / event.data.frameCount) * 4);
        if (bucket !== lastProgressBucket) {
          lastProgressBucket = bucket;
          recordDiagnosticBreadcrumb({
            category: "story",
            name: "render",
            outcome: "info",
            metadata: {
              frame: event.data.frame,
              frameCount: event.data.frameCount,
            },
          });
        }
        onProgress({
          phase: "render",
          value: Math.min(1, (event.data.frame + 1) / event.data.frameCount),
        });
        return;
      }
      if (event.data.type === "error") {
        cleanup();
        const workerError = new DiagnosticError(event.data.code, event.data.message, {
          metadata: {
            stage: event.data.stage,
            frame: event.data.frame ?? null,
            target: target.type,
            workerStack: event.data.stack?.slice(0, 500) ?? null,
          },
        });
        reject(workerError);
        return;
      }

      cleanup();
      recordDiagnosticBreadcrumb({
        category: "story",
        name: "render",
        outcome: "success",
        metadata: { target: target.type },
      });
      resolve(new Blob([event.data.buffer], { type: "video/mp4" }));
    };

    worker.postMessage(
      {
        type: "export",
        target: resolveTargetAssets(resolvedTarget),
        locale,
        theme: getResolvedStoryTheme(),
        logoUrl: makeAbsoluteUrl("/logo.svg"),
        fontUrls: {
          montserrat: [
            makeAbsoluteUrl("/fonts/montserrat-cyrillic.woff2"),
            makeAbsoluteUrl("/fonts/montserrat-latin.woff2"),
          ],
          unbounded: [
            makeAbsoluteUrl("/fonts/unbounded-cyrillic.woff2"),
            makeAbsoluteUrl("/fonts/unbounded-latin.woff2"),
          ],
        },
        audio,
      },
      audio.channels.map((channel) => channel.buffer),
    );
  });
};
