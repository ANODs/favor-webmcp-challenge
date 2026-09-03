"use client";

import { getFontEmbedCSS, toCanvas } from "html-to-image";
import { NextIntlClientProvider, useMessages } from "next-intl";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactPortal,
} from "react";
import { createPortal } from "react-dom";
import * as THREE from "three";

import {
  drawTelegramPhoneStatusBar,
  formatTelegramPhoneTime,
} from "../telegram-phone-status-bar";
import {
  WORKFLOW_PHONE_STAGES,
  WORKFLOW_STEPS,
  WORKFLOW_TYPEWRITER_TRANSITIONS,
} from "./model/timeline";
import type {
  WorkflowPhoneStageId,
  WorkflowScreenFrame,
  WorkflowScreenId,
  WorkflowTypewriterSequenceId,
} from "./model/types";
import {
  getVisibleTypewriterGlyphCount,
  mergeTypewriterLineRects,
  segmentTypewriterGraphemes,
  type TypewriterRect,
} from "./model/typewriter";
import {
  WORKFLOW_PHONE_HEIGHT,
  WORKFLOW_PHONE_WIDTH,
  WorkflowPhoneScreen,
  type WorkflowPhoneLocale,
  type WorkflowPhoneScreenId,
} from "./workflow-phone-screens";

const TEXTURE_SCALE = 2;
const INITIAL_PREVIEW_SCALE = 0.5;
const TEXTURE_WIDTH = WORKFLOW_PHONE_WIDTH * TEXTURE_SCALE;
const TEXTURE_HEIGHT = WORKFLOW_PHONE_HEIGHT * TEXTURE_SCALE;
const TEXTURE_RADIUS = 32 * TEXTURE_SCALE;

const WORKFLOW_PHONE_SCREEN_IDS_BY_SCENE: Record<
  WorkflowScreenId,
  WorkflowPhoneScreenId
> = {
  "telegram-chat": 1,
  "telegram-post": 2,
  "favor-contract-builder": 3,
  "telegram-contract-share": 4,
  "favor-deal-management": 5,
};

type TextureSource = {
  screenId: WorkflowPhoneScreenId;
  stageId: WorkflowPhoneStageId;
};

type TypewriterCapture = {
  glyphs: readonly TypewriterRect[];
  id: WorkflowTypewriterSequenceId;
  lines: readonly TypewriterRect[];
};

type CapturedTextureSource = {
  canvas: HTMLCanvasElement;
  stageId: WorkflowPhoneStageId;
  typewriter: TypewriterCapture | null;
};

const WORKFLOW_TEXTURE_SOURCES: readonly TextureSource[] =
  WORKFLOW_STEPS.flatMap((step) => {
    const stages: readonly { id: WorkflowPhoneStageId }[] =
      WORKFLOW_PHONE_STAGES[step.id];

    return stages.map((stage) => ({
      screenId: WORKFLOW_PHONE_SCREEN_IDS_BY_SCENE[step.screenId],
      stageId: stage.id,
    }));
  });

type WorkflowScreenTextureOptions = {
  locale: WorkflowPhoneLocale;
  messages: ReturnType<typeof useMessages>;
};

export type WorkflowScreenTextureController = {
  draw: (frame: WorkflowScreenFrame, statusTime: string) => boolean;
  initialReady: boolean;
  ready: boolean;
  revision: number;
  sourcePortal: ReactPortal | null;
  texture: THREE.CanvasTexture;
};

export function useWorkflowScreenTexture({
  locale,
  messages,
}: WorkflowScreenTextureOptions): WorkflowScreenTextureController {
  const sourceElementsRef = useRef(
    new Map<WorkflowPhoneStageId, HTMLDivElement>(),
  );
  const fontEmbedCssRef = useRef<Promise<string> | null>(null);
  const [surface] = useState(() => new WorkflowTextureSurface());
  const [mountedSources, setMountedSources] = useState<
    readonly TextureSource[]
  >(() => WORKFLOW_TEXTURE_SOURCES.slice(0, 1));
  const [revision, setRevision] = useState(0);
  const portalHost = document.body;

  useEffect(() => {
    let cancelled = false;

    surface.clearSources();
    queueMicrotask(() => {
      if (cancelled) return;
      setMountedSources(WORKFLOW_TEXTURE_SOURCES.slice(0, 1));
      setRevision((currentRevision) => currentRevision + 1);
    });

    const captureSources = async () => {
      await afterTwoFrames();

      const firstElement = sourceElementsRef.current.get(
        WORKFLOW_TEXTURE_SOURCES[0].stageId,
      );
      if (!firstElement) {
        throw new Error(
          "Workflow texture sources were not mounted before capture.",
        );
      }

      const captureRoot = firstElement.closest<HTMLElement>(
        "[data-workflow-texture-source-root]",
      );
      if (!captureRoot) {
        throw new Error("Workflow texture source root was not mounted.");
      }

      const captureBatch = async (
        batch: readonly TextureSource[],
        fontEmbedCSS: string,
        textureScale = TEXTURE_SCALE,
      ) => {
        const results = await Promise.allSettled(
          batch.map(async (source) => {
            const element = sourceElementsRef.current.get(source.stageId);
            if (!element) {
              throw new Error(
                `Workflow texture source ${source.stageId} was not mounted.`,
              );
            }

            await Promise.all(
              Array.from(element.querySelectorAll("img"), (image) =>
                image.decode().catch(() => undefined),
              ),
            );

            const canvas = await captureTextureElement(
              element,
              fontEmbedCSS,
              textureScale,
            );
            return {
              canvas,
              stageId: source.stageId,
              typewriter: captureTypewriterSource(
                element,
                source.stageId,
                locale,
                textureScale,
              ),
            } satisfies CapturedTextureSource;
          }),
        );
        const entries = results.flatMap((result) =>
          result.status === "fulfilled" ? [result.value] : [],
        );
        const failedResult = results.find(
          (result): result is PromiseRejectedResult =>
            result.status === "rejected",
        );

        if (failedResult || cancelled) {
          entries.forEach(({ canvas }) => releaseCanvas(canvas));
        }
        if (failedResult) throw failedResult.reason;
        if (cancelled) return false;

        surface.addSources(entries);
        setRevision((currentRevision) => currentRevision + 1);
        return true;
      };

      const [initialSource] = WORKFLOW_TEXTURE_SOURCES;
      if (!initialSource) {
        throw new Error("Workflow texture sources are empty.");
      }

      // The first frame deliberately skips font embedding and uses a smaller
      // raster. It is replaced by the full-quality capture in the first
      // background batch, but makes a usable textured phone available quickly.
      if (
        !(await captureBatch(
          [initialSource],
          "",
          INITIAL_PREVIEW_SCALE,
        ))
      ) {
        return;
      }

      // Give React and R3F a paint opportunity with the first usable phone
      // screen before continuing the more expensive background rasterization.
      await afterTwoFrames();

      await document.fonts.ready;
      if (cancelled) return;

      const fontEmbedCssPromise =
        fontEmbedCssRef.current ??
        getFontEmbedCSS(captureRoot, { preferredFontFormat: "woff2" });
      fontEmbedCssRef.current = fontEmbedCssPromise;
      const fontEmbedCSS = await fontEmbedCssPromise;

      for (let index = 0; index < WORKFLOW_TEXTURE_SOURCES.length; index += 4) {
        const batch = WORKFLOW_TEXTURE_SOURCES.slice(index, index + 4);
        setMountedSources(batch);
        await afterTwoFrames();
        if (cancelled) return;

        if (!(await captureBatch(batch, fontEmbedCSS))) return;
        await nextFrame();
      }
    };

    void captureSources().catch((error: unknown) => {
      if (cancelled) return;
      console.error("Failed to build the workflow phone texture.", error);
    });

    return () => {
      cancelled = true;
    };
  }, [locale, surface]);

  useEffect(() => () => surface.dispose(), [surface]);

  const registerSource = useCallback(
    (stageId: WorkflowPhoneStageId, element: HTMLDivElement | null) => {
      if (element) {
        sourceElementsRef.current.set(stageId, element);
      } else {
        sourceElementsRef.current.delete(stageId);
      }
    },
    [],
  );

  const sourcePortal = surface.hasAllSources()
    ? null
    : createPortal(
        <div
          aria-hidden="true"
          className="workflow-phone-theme pointer-events-none fixed left-[-10000px] top-0 text-white"
          data-theme="dark"
          data-workflow-texture-source-root="true"
          style={{ width: WORKFLOW_PHONE_WIDTH }}
        >
          <NextIntlClientProvider locale={locale} messages={messages}>
            {mountedSources.map((source) => (
              <div
                key={source.stageId}
                ref={(element) => registerSource(source.stageId, element)}
                className="overflow-hidden bg-[#08090d]"
                data-workflow-texture-source={source.stageId}
                style={{
                  height: WORKFLOW_PHONE_HEIGHT,
                  width: WORKFLOW_PHONE_WIDTH,
                }}
              >
                <WorkflowPhoneScreen
                  animateTransitions={false}
                  locale={locale}
                  screenId={source.screenId}
                  statusTime={formatTelegramPhoneTime(new Date(), locale)}
                  stageId={source.stageId}
                />
              </div>
            ))}
          </NextIntlClientProvider>
        </div>,
        portalHost,
      );

  return {
    draw: surface.draw,
    initialReady: surface.hasInitialSource(),
    ready: surface.hasAllSources(),
    revision,
    sourcePortal,
    texture: surface.texture,
  };
}

const afterTwoFrames = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

const nextFrame = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });

async function captureTextureElement(
  element: HTMLDivElement,
  fontEmbedCSS: string,
  textureScale: number,
) {
  return toCanvas(element, {
    backgroundColor: "#08090d",
    cacheBust: false,
    canvasHeight: WORKFLOW_PHONE_HEIGHT * textureScale,
    canvasWidth: WORKFLOW_PHONE_WIDTH * textureScale,
    fontEmbedCSS,
    height: WORKFLOW_PHONE_HEIGHT,
    pixelRatio: 1,
    preferredFontFormat: "woff2",
    skipAutoScale: true,
    style: {
      animation: "none",
      caretColor: "transparent",
      transform: "none",
      transition: "none",
    },
    width: WORKFLOW_PHONE_WIDTH,
  });
}

type TypewriterCaptureTarget =
  | {
      kind: "element";
      selector: string;
    }
  | {
      kind: "control";
      prefixLength?: (value: string) => number;
      selector: string;
    };

const TYPEWRITER_CAPTURE_TARGETS: Record<
  WorkflowTypewriterSequenceId,
  TypewriterCaptureTarget
> = {
  "chat-reply": {
    kind: "element",
    selector: '[data-workflow-typewriter="chat-reply"]',
  },
  "chat-favor": {
    kind: "element",
    selector: '[data-workflow-typewriter="chat-favor"]',
  },
  "contract-source-url": {
    kind: "control",
    selector: 'input[name="telegramPostUrl"]',
  },
  "contract-personalization": {
    kind: "control",
    prefixLength: (value) => {
      const separatorIndex = value.indexOf("\n\n");
      return separatorIndex >= 0 ? separatorIndex : value.length;
    },
    selector: 'textarea[name^="description"]',
  },
  "contract-price": {
    kind: "control",
    selector: 'input[name="basePrice"]',
  },
  "contract-deadline": {
    kind: "control",
    selector: 'input[name="deadlineDays"]',
  },
  "share-inline-query": {
    kind: "element",
    selector: '[data-workflow-typewriter="share-inline-query"]',
  },
};

function captureTypewriterSource(
  root: HTMLDivElement,
  stageId: WorkflowPhoneStageId,
  locale: WorkflowPhoneLocale,
  textureScale: number,
): TypewriterCapture | null {
  const transition = WORKFLOW_TYPEWRITER_TRANSITIONS[stageId];
  if (!transition) return null;

  const target = TYPEWRITER_CAPTURE_TARGETS[transition.id];
  const element = root.querySelector(target.selector);
  if (!element) return null;

  const glyphs =
    target.kind === "element"
      ? collectElementGlyphRects(root, element, locale)
      : element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement
        ? collectControlGlyphRects(
            root,
            element,
            locale,
            target.prefixLength?.(element.value) ?? 0,
          )
        : [];
  const scaledGlyphs = glyphs.map((glyph) => ({
    x: glyph.x * textureScale,
    y: glyph.y * textureScale,
    width: glyph.width * textureScale,
    height: glyph.height * textureScale,
  }));
  if (scaledGlyphs.length === 0) return null;

  return {
    glyphs: scaledGlyphs,
    id: transition.id,
    lines: mergeTypewriterLineRects(scaledGlyphs),
  };
}

function collectElementGlyphRects(
  root: HTMLElement,
  element: Element,
  locale: WorkflowPhoneLocale,
) {
  const rootRect = root.getBoundingClientRect();
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const glyphs: TypewriterRect[] = [];
  let textNode = walker.nextNode();

  while (textNode) {
    const currentTextNode = textNode;
    const value = currentTextNode.textContent ?? "";
    segmentTypewriterGraphemes(value, locale).forEach(({ index, segment }) => {
      const range = document.createRange();
      range.setStart(currentTextNode, index);
      range.setEnd(currentTextNode, index + segment.length);
      const rect = range.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        glyphs.push({
          x: rect.left - rootRect.left,
          y: rect.top - rootRect.top,
          width: rect.width,
          height: rect.height,
        });
      }
      range.detach();
    });

    textNode = walker.nextNode();
  }

  return glyphs;
}

function collectControlGlyphRects(
  root: HTMLElement,
  control: HTMLInputElement | HTMLTextAreaElement,
  locale: WorkflowPhoneLocale,
  prefixLength: number,
) {
  const value = control.value;
  if (!value) return [];

  const rootRect = root.getBoundingClientRect();
  const controlRect = control.getBoundingClientRect();
  const computedStyle = window.getComputedStyle(control);
  const mirror = document.createElement("div");
  const mirrorText = document.createTextNode(value);

  mirror.setAttribute("aria-hidden", "true");
  mirror.style.position = "fixed";
  mirror.style.left = "-20000px";
  mirror.style.top = "0";
  mirror.style.boxSizing = computedStyle.boxSizing;
  mirror.style.width = `${controlRect.width}px`;
  mirror.style.height = `${controlRect.height}px`;
  mirror.style.padding = computedStyle.padding;
  mirror.style.borderStyle = computedStyle.borderStyle;
  mirror.style.borderWidth = computedStyle.borderWidth;
  mirror.style.borderColor = "transparent";
  mirror.style.font = computedStyle.font;
  mirror.style.fontFamily = computedStyle.fontFamily;
  mirror.style.fontSize = computedStyle.fontSize;
  mirror.style.fontStyle = computedStyle.fontStyle;
  mirror.style.fontWeight = computedStyle.fontWeight;
  mirror.style.letterSpacing = computedStyle.letterSpacing;
  mirror.style.lineHeight = computedStyle.lineHeight;
  mirror.style.textAlign = computedStyle.textAlign;
  mirror.style.textTransform = computedStyle.textTransform;
  mirror.style.direction = computedStyle.direction;
  mirror.style.overflow = "hidden";
  mirror.style.whiteSpace =
    control instanceof HTMLTextAreaElement ? "pre-wrap" : "pre";
  mirror.style.overflowWrap = computedStyle.overflowWrap;
  mirror.style.wordBreak = computedStyle.wordBreak;
  mirror.append(mirrorText);
  document.body.append(mirror);

  const mirrorRect = mirror.getBoundingClientRect();
  const controlLeft = controlRect.left - rootRect.left;
  const controlTop = controlRect.top - rootRect.top;
  const controlRight = controlLeft + controlRect.width;
  const controlBottom = controlTop + controlRect.height;
  const glyphs = segmentTypewriterGraphemes(value, locale).flatMap(
    ({ index, segment }) => {
      if (index < prefixLength) return [];

      const range = document.createRange();
      range.setStart(mirrorText, index);
      range.setEnd(mirrorText, index + segment.length);
      const rect = range.getBoundingClientRect();
      range.detach();

      const rawLeft =
        controlLeft + rect.left - mirrorRect.left - control.scrollLeft;
      const rawTop =
        controlTop + rect.top - mirrorRect.top - control.scrollTop;
      const left = Math.max(controlLeft, rawLeft);
      const top = Math.max(controlTop, rawTop);
      const right = Math.min(controlRight, rawLeft + rect.width);
      const bottom = Math.min(controlBottom, rawTop + rect.height);

      return right > left && bottom > top
        ? [{ x: left, y: top, width: right - left, height: bottom - top }]
        : [];
    },
  );

  mirror.remove();
  return glyphs;
}

function drawEmptyScreen(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d");
  if (!context) return;

  context.clearRect(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT);
  context.save();
  context.beginPath();
  context.roundRect(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT, TEXTURE_RADIUS);
  context.clip();
  context.fillStyle = "#08090d";
  context.fillRect(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT);
  context.restore();
}

function drawWorkflowScreenFrame(
  target: HTMLCanvasElement,
  fromSource: CapturedTextureSource,
  toSource: CapturedTextureSource,
  frame: WorkflowScreenFrame,
  statusTime: string,
) {
  const context = target.getContext("2d");
  if (!context) return;

  const blend = THREE.MathUtils.clamp(frame.blend, 0, 1);
  const fromCanvas = fromSource.canvas;
  const toCanvas = toSource.canvas;
  drawEmptyScreen(target);

  context.save();
  context.beginPath();
  context.roundRect(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT, TEXTURE_RADIUS);
  context.clip();

  if (fromCanvas === toCanvas || blend <= 0.001) {
    drawLayer(context, fromCanvas, 1, 1, 0);
  } else if (blend >= 0.999) {
    drawLayer(context, toCanvas, 1, 1, 0);
  } else if (
    frame.typewriter &&
    toSource.typewriter?.id === frame.typewriter.id
  ) {
    drawTypewriterLayer(
      context,
      fromCanvas,
      toCanvas,
      toSource.typewriter,
      frame.typewriter.progress,
    );
  } else if (frame.fromId === frame.toId) {
    const incoming = smoothstep(0.04, 0.96, blend);

    drawLayer(context, fromCanvas, 1, 1, 0);
    drawLayer(context, toCanvas, incoming, 1, 0);
  } else {
    const outgoing = 1 - smoothstep(0.08, 0.62, blend);
    const incoming = smoothstep(0.38, 0.92, blend);

    drawLayer(
      context,
      fromCanvas,
      outgoing,
      1 - 0.018 * blend,
      -18 * blend,
    );
    drawLayer(
      context,
      toCanvas,
      incoming,
      0.982 + 0.018 * incoming,
      18 * (1 - incoming),
    );
  }

  context.restore();
  context.save();
  context.beginPath();
  context.roundRect(
    0,
    0,
    TEXTURE_WIDTH,
    TEXTURE_HEIGHT,
    TEXTURE_RADIUS,
  );
  context.clip();
  context.scale(TEXTURE_SCALE, TEXTURE_SCALE);
  drawTelegramPhoneStatusBar(context, statusTime);
  context.restore();
}

function drawLayer(
  context: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  opacity: number,
  scale: number,
  translateY: number,
) {
  context.save();
  context.globalAlpha = opacity;
  context.translate(TEXTURE_WIDTH / 2, TEXTURE_HEIGHT / 2 + translateY);
  context.scale(scale, scale);
  context.drawImage(
    source,
    -TEXTURE_WIDTH / 2,
    -TEXTURE_HEIGHT / 2,
    TEXTURE_WIDTH,
    TEXTURE_HEIGHT,
  );
  context.restore();
}

function drawTypewriterLayer(
  context: CanvasRenderingContext2D,
  fromCanvas: HTMLCanvasElement,
  toCanvas: HTMLCanvasElement,
  capture: TypewriterCapture,
  progress: number,
) {
  drawLayer(context, toCanvas, 1, 1, 0);

  capture.lines.forEach((line) =>
    drawTextureRect(context, fromCanvas, line, 1.5),
  );

  const visibleGlyphCount = getVisibleTypewriterGlyphCount(
    capture.glyphs.length,
    progress,
  );
  capture.glyphs
    .slice(0, visibleGlyphCount)
    .forEach((glyph) => drawTextureRect(context, toCanvas, glyph, 0.75));

  if (visibleGlyphCount >= capture.glyphs.length) return;

  const nextGlyph = capture.glyphs[visibleGlyphCount];
  const previousGlyph = capture.glyphs[visibleGlyphCount - 1];
  const caretX = previousGlyph
    ? previousGlyph.x + previousGlyph.width
    : nextGlyph?.x;
  const caretY = previousGlyph?.y ?? nextGlyph?.y;
  const caretHeight = previousGlyph?.height ?? nextGlyph?.height;
  if (caretX === undefined || caretY === undefined || caretHeight === undefined) {
    return;
  }

  context.save();
  context.fillStyle = capture.id.startsWith("contract-")
    ? "#75f760"
    : "rgba(255,255,255,0.9)";
  context.fillRect(caretX + 0.5, caretY + 1, 1.5, Math.max(2, caretHeight - 2));
  context.restore();
}

function drawTextureRect(
  context: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  rect: TypewriterRect,
  padding: number,
) {
  const x = Math.max(0, rect.x - padding);
  const y = Math.max(0, rect.y - padding);
  const width = Math.min(TEXTURE_WIDTH - x, rect.width + padding * 2);
  const height = Math.min(TEXTURE_HEIGHT - y, rect.height + padding * 2);
  if (width <= 0 || height <= 0) return;

  context.drawImage(source, x, y, width, height, x, y, width, height);
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const amount = THREE.MathUtils.clamp(
    (value - edge0) / (edge1 - edge0),
    0,
    1,
  );
  return amount * amount * (3 - 2 * amount);
}

class WorkflowTextureSurface {
  readonly texture: THREE.CanvasTexture;

  private lastFrame = "";
  private stageSources = new Map<
    WorkflowPhoneStageId,
    CapturedTextureSource
  >();

  constructor() {
    const canvas = document.createElement("canvas");
    canvas.width = TEXTURE_WIDTH;
    canvas.height = TEXTURE_HEIGHT;
    drawEmptyScreen(canvas);

    this.texture = new THREE.CanvasTexture(canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 8;
    this.texture.minFilter = THREE.LinearMipmapLinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.wrapS = THREE.ClampToEdgeWrapping;
    this.texture.wrapT = THREE.ClampToEdgeWrapping;
  }

  readonly draw = (frame: WorkflowScreenFrame, statusTime: string) => {
    const frameKey = [
      frame.fromStageId,
      frame.toStageId,
      frame.blend.toFixed(4),
      statusTime,
    ].join(":");

    if (this.lastFrame === frameKey) return false;

    const fromSource = this.stageSources.get(frame.fromStageId);
    const toSource = this.stageSources.get(frame.toStageId);
    if (!fromSource || !toSource) return false;

    drawWorkflowScreenFrame(
      this.texture.image as HTMLCanvasElement,
      fromSource,
      toSource,
      frame,
      statusTime,
    );
    this.texture.needsUpdate = true;
    this.lastFrame = frameKey;
    return true;
  };

  clearSources() {
    this.stageSources.forEach(({ canvas }) => releaseCanvas(canvas));
    this.stageSources.clear();
    this.lastFrame = "";
  }

  hasAllSources() {
    return this.stageSources.size === WORKFLOW_TEXTURE_SOURCES.length;
  }

  hasInitialSource() {
    const initialSource = WORKFLOW_TEXTURE_SOURCES[0];
    return initialSource
      ? this.stageSources.has(initialSource.stageId)
      : false;
  }

  addSources(sources: readonly CapturedTextureSource[]) {
    sources.forEach((source) => {
      const previousSource = this.stageSources.get(source.stageId);
      if (previousSource && previousSource.canvas !== source.canvas) {
        releaseCanvas(previousSource.canvas);
      }

      this.stageSources.set(source.stageId, source);
    });
    this.lastFrame = "";
  }

  dispose() {
    this.clearSources();
    this.texture.dispose();
  }
}

function releaseCanvas(canvas: HTMLCanvasElement) {
  canvas.width = 0;
  canvas.height = 0;
}
