import {
  AudioSample,
  AudioSampleSource,
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  Quality,
} from "mediabunny";
import {
  ACESFilmicToneMapping,
  AmbientLight,
  BufferGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  Float32BufferAttribute,
  Group,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  ShadowMaterial,
  ShapeUtils,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Vector2,
  VSMShadowMap,
  WebGLRenderer,
} from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

import type {
  TelegramStoryLocale,
  TelegramStoryTarget,
  TelegramStoryTheme,
} from "../model/types";
import englishCopy from "./story-video-copy.en.json";
import russianCopy from "./story-video-copy.ru.json";

const WIDTH = 1080;
const HEIGHT = 1920;
const FRAME_RATE = 60;
const FRAME_DURATION = 1 / FRAME_RATE;
const ANIMATION_DURATION = 10;
const CARD = { x: 145, y: 510, width: 790, height: 1130 };
const CARD_CORNER_RADIUS = 58;
const CARD_WORLD_HEIGHT = 6.08;
const CARD_WORLD_WIDTH = CARD_WORLD_HEIGHT * (CARD.width / CARD.height);
const CARD_WORLD_DEPTH = 0.42;
const CARD_WORLD_RADIUS = CARD_WORLD_HEIGHT * (CARD_CORNER_RADIUS / CARD.height);
const CARD_BEVEL_DEPTH = 0.12;
const CARD_BACK_OVERHANG = 0.055;
const CARD_CORNER_SEGMENTS = 14;
const CARD_BEVEL_SEGMENTS = 8;
const STORY_SCENE_LAYOUT = {
  cardBaseCenterY: -0.23,
  cardVerticalLiftRatio: 0.05,
} as const;
const CARD_WORLD_CENTER_Y =
  STORY_SCENE_LAYOUT.cardBaseCenterY +
  CARD_WORLD_HEIGHT * STORY_SCENE_LAYOUT.cardVerticalLiftRatio;
const PIXELS_PER_WORLD_UNIT = CARD.height / CARD_WORLD_HEIGHT;
const BODY_FONT = '"Favor Montserrat", Arial, sans-serif';
const DISPLAY_FONT = '"Favor Unbounded", "Favor Montserrat", Arial, sans-serif';

type StoryPalette = {
  background: string;
  foreground: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  muted: string;
  accent: string;
  accentSoft: string;
  accentInk: string;
  shadow: string;
};

const palettes: Record<TelegramStoryTheme, StoryPalette> = {
  light: {
    background: "#ffffff",
    foreground: "#000000",
    surface: "#f4f4f5",
    surfaceMuted: "#ffffff",
    border: "#e4e4e7",
    muted: "#71717a",
    accent: "#75F760",
    accentSoft: "#dfffd9",
    accentInk: "#10230d",
    shadow: "rgba(9, 9, 11, 0.18)",
  },
  dark: {
    background: "#000000",
    foreground: "#ffffff",
    surface: "#0a0a0a",
    surfaceMuted: "#18181b",
    border: "#27272a",
    muted: "#a1a1aa",
    accent: "#75F760",
    accentSoft: "#173b17",
    accentInk: "#071007",
    shadow: "rgba(0, 0, 0, 0.7)",
  },
};

const bodyFont = (weight: number, size: number) =>
  `${weight} ${size}px ${BODY_FONT}`;
const displayFont = (weight: number, size: number) =>
  `${weight} ${size}px ${DISPLAY_FONT}`;

type StoryAudio = {
  channels: Float32Array[];
  sampleRate: number;
  length: number;
};

type ExportMessage = {
  type: "export";
  target: TelegramStoryTarget;
  locale: TelegramStoryLocale;
  theme: TelegramStoryTheme;
  logoUrl: string;
  fontUrls: {
    montserrat: string[];
    unbounded: string[];
  };
  audio: StoryAudio;
};

type StoryWorkerStage =
  | "fonts"
  | "assets"
  | "scene-init"
  | "encoder-init"
  | "render"
  | "audio"
  | "finalize";

const errorCodeByStage: Record<StoryWorkerStage, string> = {
  fonts: "STORY_FONT_LOAD_FAILED",
  assets: "STORY_ASSET_LOAD_FAILED",
  "scene-init": "STORY_SCENE_INIT_FAILED",
  "encoder-init": "STORY_ENCODER_INIT_FAILED",
  render: "STORY_RENDER_FAILED",
  audio: "STORY_AUDIO_ENCODE_FAILED",
  finalize: "STORY_FINALIZE_FAILED",
};

type Transform = {
  tx: number;
  ty: number;
  tz: number;
  rx: number;
  ry: number;
  rz: number;
};

type StoryVideoCopy = {
  [Key in keyof typeof englishCopy]: string;
};

const copyByLocale = {
  en: englishCopy,
  ru: russianCopy,
} satisfies Record<TelegramStoryLocale, StoryVideoCopy>;

const keyframes: Transform[] = [
  { tx: -3, ty: 0, tz: 0, rx: -0.8, ry: -14, rz: 0 },
  { tx: 0, ty: -2, tz: 18, rx: 0.6, ry: 0, rz: -4 },
  { tx: 3, ty: 0, tz: 0, rx: 1.2, ry: 14, rz: -8 },
  { tx: 0, ty: 2, tz: 18, rx: 0.6, ry: 0, rz: -4 },
  { tx: -3, ty: 0, tz: 0, rx: -0.8, ry: -14, rz: 0 },
];

const createCanvas = (width: number, height: number) => {
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2D canvas is unavailable");
  return { canvas, context };
};

const roundedPath = (
  context: OffscreenCanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) => {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
};

const fillRounded = (
  context: OffscreenCanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill: string | CanvasGradient,
) => {
  roundedPath(context, x, y, width, height, radius);
  context.fillStyle = fill;
  context.fill();
};

const wrapText = (
  context: OffscreenCanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
) => {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (context.measureText(candidate).width <= maxWidth || !current) {
      current = candidate;
      continue;
    }
    lines.push(current);
    current = word;
    if (lines.length === maxLines) break;
  }
  if (current && lines.length < maxLines) lines.push(current);

  const consumed = lines.join(" ").length;
  if (consumed < text.trim().length && lines.length) {
    let finalLine = lines[lines.length - 1];
    while (finalLine && context.measureText(`${finalLine}…`).width > maxWidth) {
      finalLine = finalLine.slice(0, -1).trimEnd();
    }
    lines[lines.length - 1] = `${finalLine}…`;
  }
  return lines;
};

const drawLines = (
  context: OffscreenCanvasRenderingContext2D,
  lines: string[],
  x: number,
  y: number,
  lineHeight: number,
) => {
  lines.forEach((line, index) => context.fillText(line, x, y + index * lineHeight));
};

const drawFullHeadline = (
  context: OffscreenCanvasRenderingContext2D,
  text: string,
  y: number,
  palette: StoryPalette,
) => {
  for (let size = 46; size >= 32; size -= 2) {
    context.font = displayFont(700, size);
    const lines = wrapText(context, text, 900, 3);
    const isComplete = !lines.at(-1)?.endsWith("…");
    if (isComplete || size === 32) {
      context.fillStyle = palette.foreground;
      context.textAlign = "center";
      lines.forEach((line, index) => context.fillText(line, WIDTH / 2, y + index * (size + 10)));
      context.textAlign = "left";
      return;
    }
  }
};

const loadBitmap = async (url?: string | null) => {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return await createImageBitmap(await response.blob(), {
      premultiplyAlpha: "premultiply",
      colorSpaceConversion: "default",
    });
  } catch {
    return null;
  }
};

const loadLogoPath = async (url: string) => {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return (await response.text()).match(/<path[^>]+d="([^"]+)"/)?.[1] ?? null;
  } catch {
    return null;
  }
};

const loadBrandFonts = async (fontUrls: ExportMessage["fontUrls"]) => {
  const scope = self as unknown as { fonts?: FontFaceSet };
  if (!scope.fonts || typeof FontFace === "undefined") return;

  const definitions = [
    ...fontUrls.montserrat.map((url, index) => ({
      family: "Favor Montserrat",
      url,
      unicodeRange:
        index === 0
          ? "U+0301, U+0400-052F, U+1C80-1C8A, U+20B4, U+2116, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F"
          : "U+0000-036F, U+1E00-1EFF, U+2000-206F, U+20AC, U+2122, U+2190-21FF, U+2212, U+2215, U+FEFF, U+FFFD",
    })),
    ...fontUrls.unbounded.map((url, index) => ({
      family: "Favor Unbounded",
      url,
      unicodeRange:
        index === 0
          ? "U+0301, U+0400-052F, U+1C80-1C8A, U+20B4, U+2116, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F"
          : "U+0000-036F, U+1E00-1EFF, U+2000-206F, U+20AC, U+2122, U+2190-21FF, U+2212, U+2215, U+FEFF, U+FFFD",
    })),
  ];

  await Promise.all(
    definitions.map(async ({ family, url, unicodeRange }) => {
      try {
        const face = new FontFace(family, `url(${url})`, {
          display: "swap",
          style: "normal",
          weight: family === "Favor Unbounded" ? "200 900" : "100 900",
          unicodeRange,
        });
        scope.fonts?.add(await face.load());
      } catch {
        // Arial remains an intentional rendering fallback on older workers.
      }
    }),
  );
};

const drawCover = (
  context: OffscreenCanvasRenderingContext2D,
  image: ImageBitmap,
  x: number,
  y: number,
  width: number,
  height: number,
) => {
  const scale = Math.max(width / image.width, height / image.height);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  context.drawImage(
    image,
    (image.width - sourceWidth) / 2,
    (image.height - sourceHeight) / 2,
    sourceWidth,
    sourceHeight,
    x,
    y,
    width,
    height,
  );
};

const drawBrand = (
  context: OffscreenCanvasRenderingContext2D,
  logoPath: string | null,
  palette: StoryPalette,
) => {
  fillRounded(context, 318, 70, 96, 96, 21, palette.foreground);
  if (logoPath) {
    context.save();
    context.translate(335, 87);
    context.scale(62 / 512, 62 / 512);
    context.fillStyle = palette.background;
    context.fill(new Path2D(logoPath));
    context.restore();
  } else {
    context.fillStyle = palette.background;
    context.font = displayFont(800, 58);
    context.fillText("F", 338, 139);
  }
  context.fillStyle = palette.foreground;
  context.font = displayFont(800, 58);
  context.fillText("FAVOR", 446, 136);
};

const drawBackground = async (
  target: TelegramStoryTarget,
  locale: TelegramStoryLocale,
  logoUrl: string,
  theme: TelegramStoryTheme,
) => {
  const { canvas, context } = createCanvas(WIDTH, HEIGHT);
  const palette = palettes[theme];
  const logoPath = await loadLogoPath(logoUrl);
  context.fillStyle = palette.background;
  context.fillRect(0, 0, WIDTH, HEIGHT);
  drawBrand(context, logoPath, palette);

  const headline =
    target.type === "contract"
      ? target.title
      : target.type === "profile"
        ? copyByLocale[locale].profileHeadline
        : copyByLocale[locale].referralHeadline;
  drawFullHeadline(context, headline, 235, palette);

  const green = context.createLinearGradient(75, 640, 985, 1440);
  green.addColorStop(0, "#a8ff12");
  green.addColorStop(0.55, "#8af000");
  green.addColorStop(1, "#bdff2b");
  fillRounded(context, 62, 655, 956, 880, 125, green);

  context.fillStyle = palette.foreground;
  context.font = bodyFont(700, 29);
  context.textAlign = "center";
  context.fillText(copyByLocale[locale].footer, WIDTH / 2, 1815);
  context.textAlign = "left";
  return canvas;
};

const prepareCardCanvas = (palette: StoryPalette) => {
  const { canvas, context } = createCanvas(CARD.width, CARD.height);
  fillRounded(context, 0, 0, CARD.width, CARD.height, 58, palette.surface);
  return { canvas, context, x: 0, y: 0 };
};

const drawContractCard = async (
  target: Extract<TelegramStoryTarget, { type: "contract" }>,
  locale: TelegramStoryLocale,
  palette: StoryPalette,
) => {
  const { canvas, context, x, y } = prepareCardCanvas(palette);
  const labels = copyByLocale[locale];
  const image = await loadBitmap(target.imageUrl);

  context.save();
  roundedPath(context, x, y, CARD.width, CARD.height, 58);
  context.clip();
  if (image) {
    drawCover(context, image, x, y, CARD.width, 430);
  } else {
    const fallback = context.createLinearGradient(x, y, x + CARD.width, y + 430);
    fallback.addColorStop(0, palette.foreground);
    fallback.addColorStop(0.55, palette.surfaceMuted);
    fallback.addColorStop(1, palette.accent);
    context.fillStyle = fallback;
    context.fillRect(x, y, CARD.width, 430);
  }
  context.fillStyle = palette.surface;
  context.fillRect(x, y + 430, CARD.width, CARD.height - 430);
  context.restore();
  image?.close();

  const bodyX = x + 46;
  const bodyWidth = CARD.width - 92;
  context.fillStyle = palette.foreground;
  context.font = displayFont(750, 43);
  const titleLines = wrapText(
    context,
    target.categoryLabel || target.category || target.title,
    bodyWidth,
    2,
  );
  drawLines(context, titleLines, bodyX, y + 505, 50);

  const descriptionY = y + 505 + titleLines.length * 50 + 18;
  context.fillStyle = palette.muted;
  context.font = bodyFont(400, 26);
  drawLines(
    context,
    wrapText(context, target.description, bodyWidth, 3),
    bodyX,
    descriptionY,
    35,
  );

  const termsTop = y + 775;
  context.strokeStyle = palette.border;
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(bodyX, termsTop);
  context.lineTo(bodyX + bodyWidth, termsTop);
  context.moveTo(x + CARD.width / 2, termsTop);
  context.lineTo(x + CARD.width / 2, termsTop + 142);
  context.moveTo(bodyX, termsTop + 142);
  context.lineTo(bodyX + bodyWidth, termsTop + 142);
  context.stroke();

  context.fillStyle = palette.foreground;
  context.font = displayFont(750, 43);
  context.fillText(
    target.price ? `${target.price} ${target.currency}` : "—",
    bodyX,
    termsTop + 62,
  );
  context.fillText(
    target.deadlineDays ? `${target.deadlineDays} ${labels.days}` : "—",
    x + CARD.width / 2 + 38,
    termsTop + 62,
  );
  context.fillStyle = palette.muted;
  context.font = bodyFont(400, 20);
  context.fillText(`${labels.payment}: ${labels.direct}`, bodyX, termsTop + 102);
  context.fillText(labels.deadline, x + CARD.width / 2 + 38, termsTop + 102);

  const statsTop = termsTop + 142;
  context.beginPath();
  context.moveTo(x + CARD.width / 2, statsTop);
  context.lineTo(x + CARD.width / 2, statsTop + 135);
  context.moveTo(bodyX, statsTop + 67);
  context.lineTo(bodyX + bodyWidth, statsTop + 67);
  context.moveTo(bodyX, statsTop + 135);
  context.lineTo(bodyX + bodyWidth, statsTop + 135);
  context.stroke();
  context.fillStyle = palette.muted;
  context.font = bodyFont(500, 19);
  context.fillText(`${target.openDealsCount} ${labels.open}`, bodyX, statsTop + 42);
  context.fillText(
    `${target.completedDealsCount} ${labels.completed}`,
    x + CARD.width / 2 + 38,
    statsTop + 42,
  );
  context.fillText(`${target.viewsCount} ${labels.views}`, bodyX, statsTop + 109);
  context.fillText(
    target.rating ? target.rating.toFixed(1).replace(".", locale === "ru" ? "," : ".") : labels.noRating,
    x + CARD.width / 2 + 38,
    statsTop + 109,
  );

  if (target.tags.length) {
    context.fillStyle = palette.muted;
    context.font = bodyFont(700, 18);
    context.fillText(
      target.tags.slice(0, 4).map((tag) => `#${tag}`).join("   "),
      bodyX,
      y + CARD.height - 38,
    );
  }
  return canvas;
};

const drawProfileCard = async (
  target: Extract<TelegramStoryTarget, { type: "profile" }>,
  locale: TelegramStoryLocale,
  palette: StoryPalette,
) => {
  const { canvas, context, x, y } = prepareCardCanvas(palette);
  const labels = copyByLocale[locale];
  const avatar = await loadBitmap(target.avatarUrl);

  context.save();
  roundedPath(context, x, y, CARD.width, CARD.height, 58);
  context.clip();
  const header = context.createLinearGradient(x, y, x + CARD.width, y);
  header.addColorStop(0, "#111111");
  header.addColorStop(0.52, "#222a16");
  header.addColorStop(1, palette.accent);
  context.fillStyle = header;
  context.fillRect(x, y, CARD.width, 430);
  context.fillStyle = palette.surface;
  context.fillRect(x, y + 430, CARD.width, CARD.height - 430);
  context.restore();

  context.fillStyle = palette.accent;
  context.font = bodyFont(800, 22);
  context.fillText(labels.profileEyebrow, x + 48, y + 72);
  context.fillStyle = "#ffffff";
  context.font = displayFont(750, 38);
  drawLines(context, wrapText(context, target.displayName, 390, 2), x + 48, y + 145, 45);

  const avatarX = x + 590;
  const avatarY = y + 220;
  context.beginPath();
  context.arc(avatarX, avatarY, 112, 0, Math.PI * 2);
  context.fillStyle = palette.surface;
  context.fill();
  context.strokeStyle = "#ffffff";
  context.lineWidth = 10;
  context.stroke();
  if (avatar) {
    context.save();
    context.beginPath();
    context.arc(avatarX, avatarY, 104, 0, Math.PI * 2);
    context.clip();
    drawCover(context, avatar, avatarX - 104, avatarY - 104, 208, 208);
    context.restore();
  } else {
    context.fillStyle = palette.foreground;
    context.font = displayFont(750, 82);
    context.textAlign = "center";
    context.fillText(target.displayName.trim().charAt(0).toUpperCase() || "F", avatarX, avatarY + 28);
  }
  context.textAlign = "left";
  avatar?.close();

  const bodyX = x + 48;
  const bodyWidth = CARD.width - 96;
  context.fillStyle = palette.foreground;
  context.font = displayFont(750, 45);
  context.fillText(target.displayName, bodyX, y + 510);
  context.fillStyle = palette.muted;
  context.font = bodyFont(400, 25);
  context.fillText(
    target.telegramUsername ? `@${target.telegramUsername.replace(/^@/, "")}` : "favor.deals",
    bodyX,
    y + 550,
  );
  context.fillStyle = palette.muted;
  context.font = bodyFont(400, 27);
  drawLines(context, wrapText(context, labels.profileBody, bodyWidth, 3), bodyX, y + 625, 38);

  const metricsY = y + 785;
  const metricWidth = bodyWidth / 3;
  context.strokeStyle = palette.border;
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(bodyX, metricsY);
  context.lineTo(bodyX + bodyWidth, metricsY);
  context.moveTo(bodyX, metricsY + 180);
  context.lineTo(bodyX + bodyWidth, metricsY + 180);
  context.moveTo(bodyX + metricWidth, metricsY);
  context.lineTo(bodyX + metricWidth, metricsY + 180);
  context.moveTo(bodyX + metricWidth * 2, metricsY);
  context.lineTo(bodyX + metricWidth * 2, metricsY + 180);
  context.stroke();
  const metrics = [
    [target.rating.toFixed(1).replace(".", locale === "ru" ? "," : "."), labels.rating],
    [String(target.completedDealsCount), labels.deals],
    [String(target.contractsCount), labels.offers],
  ];
  metrics.forEach(([value, label], index) => {
    const metricX = bodyX + metricWidth * index + 18;
    context.fillStyle = palette.foreground;
    context.font = displayFont(750, 49);
    context.fillText(value, metricX, metricsY + 78);
    context.fillStyle = palette.muted;
    context.font = bodyFont(400, 20);
    context.fillText(label, metricX, metricsY + 120);
  });

  fillRounded(context, bodyX, y + 1010, bodyWidth, 72, 24, palette.surfaceMuted);
  context.fillStyle = palette.muted;
  context.font = bodyFont(600, 19);
  context.textAlign = "center";
  context.fillText(labels.profileNote, x + CARD.width / 2, y + 1054);
  context.textAlign = "left";
  return canvas;
};

const drawReferralIllustration = (
  context: OffscreenCanvasRenderingContext2D,
  x: number,
  y: number,
  palette: StoryPalette,
) => {
  context.save();
  context.translate(x, y);
  context.rotate(-0.08);
  context.shadowColor = palette.shadow;
  context.shadowBlur = 16;
  context.shadowOffsetY = 8;
  fillRounded(context, -150, -94, 300, 188, 28, palette.surface);
  context.shadowColor = "transparent";
  fillRounded(context, -118, -56, 174, 18, 9, palette.foreground);
  fillRounded(context, -118, -18, 228, 13, 7, palette.border);
  fillRounded(context, -118, 14, 190, 13, 7, palette.border);
  fillRounded(context, 54, 48, 58, 20, 10, palette.accent);
  context.restore();
};

const drawReferralCard = (
  target: Extract<TelegramStoryTarget, { type: "referral" }>,
  locale: TelegramStoryLocale,
  palette: StoryPalette,
) => {
  const { canvas, context, x, y } = prepareCardCanvas(palette);
  const labels = copyByLocale[locale];

  context.save();
  roundedPath(context, x, y, CARD.width, CARD.height, 58);
  context.clip();
  const header = context.createLinearGradient(x, y, x + CARD.width, y + 420);
  header.addColorStop(0, "#111111");
  header.addColorStop(0.58, "#273217");
  header.addColorStop(1, palette.accent);
  context.fillStyle = header;
  context.fillRect(x, y, CARD.width, 400);
  context.fillStyle = palette.surface;
  context.fillRect(x, y + 400, CARD.width, CARD.height - 400);
  context.restore();

  context.fillStyle = palette.accent;
  context.font = bodyFont(800, 22);
  context.fillText(labels.referralEyebrow, x + 48, y + 70);
  context.fillStyle = "#ffffff";
  context.font = displayFont(750, 42);
  drawLines(context, wrapText(context, labels.referralTitle, 420, 3), x + 48, y + 140, 49);
  drawReferralIllustration(context, x + 605, y + 220, palette);

  const bodyX = x + 48;
  const bodyWidth = CARD.width - 96;
  context.fillStyle = palette.muted;
  context.font = bodyFont(400, 27);
  drawLines(context, wrapText(context, labels.referralBody, bodyWidth, 3), bodyX, y + 475, 38);

  const items = [
    ["01", labels.referralOne, labels.referralOneBody],
    ["02", labels.referralTwo, labels.referralTwoBody],
    ["03", labels.referralThree, labels.referralThreeBody],
  ];
  items.forEach(([number, title, body], index) => {
    const itemY = y + 620 + index * 125;
    fillRounded(
      context,
      bodyX,
      itemY,
      62,
      62,
      20,
      index === 0 ? palette.accent : palette.surfaceMuted,
    );
    context.fillStyle = index === 0 ? palette.accentInk : palette.foreground;
    context.font = displayFont(750, 21);
    context.textAlign = "center";
    context.fillText(number, bodyX + 31, itemY + 39);
    context.textAlign = "left";
    context.fillStyle = palette.foreground;
    context.font = displayFont(750, 28);
    context.fillText(title, bodyX + 86, itemY + 25);
    context.fillStyle = palette.muted;
    context.font = bodyFont(400, 20);
    drawLines(context, wrapText(context, body, bodyWidth - 86, 2), bodyX + 86, itemY + 58, 27);
  });

  const stats = target.stats;
  const metrics = [
    [stats ? formatCompactNumber(stats.usersCount, locale) : "—", labels.referralUsers],
    [
      stats ? formatCompactNumber(stats.activeContractsCount, locale) : "—",
      labels.referralActive,
    ],
    [
      stats ? formatCompactNumber(stats.completedDealsCount, locale) : "—",
      labels.referralCompleted,
    ],
  ];
  const metricsY = y + 995;
  const metricWidth = bodyWidth / metrics.length;
  fillRounded(context, bodyX, metricsY, bodyWidth, 96, 24, palette.surfaceMuted);
  metrics.forEach(([value, label], index) => {
    const centerX = bodyX + metricWidth * (index + 0.5);
    if (index > 0) {
      context.strokeStyle = palette.border;
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(bodyX + metricWidth * index, metricsY + 17);
      context.lineTo(bodyX + metricWidth * index, metricsY + 79);
      context.stroke();
    }
    context.textAlign = "center";
    context.fillStyle = palette.foreground;
    context.font = displayFont(750, 26);
    context.fillText(value, centerX, metricsY + 40);
    context.fillStyle = palette.muted;
    context.font = bodyFont(600, 15);
    context.fillText(label, centerX, metricsY + 70);
  });
  context.textAlign = "left";
  return canvas;
};

const formatCompactNumber = (value: number, locale: TelegramStoryLocale) =>
  new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-US", {
    maximumFractionDigits: 1,
    notation: value >= 10_000 ? "compact" : "standard",
  }).format(value);

const easeInOut = (value: number) => 0.5 - 0.5 * Math.cos(Math.PI * value);
const mix = (from: number, to: number, amount: number) => from + (to - from) * amount;
const degrees = (value: number) => (value * Math.PI) / 180;

type CardContourPoint = {
  normalX: number;
  normalY: number;
  x: number;
  y: number;
};

type CardProfileRing = {
  expansion: number;
  normalOut: number;
  normalZ: number;
  z: number;
};

const makeRoundedCardContour = (
  width: number,
  height: number,
  radius: number,
): CardContourPoint[] => {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const corners = [
    {
      centerX: halfWidth - radius,
      centerY: -halfHeight + radius,
      start: -Math.PI / 2,
    },
    {
      centerX: halfWidth - radius,
      centerY: halfHeight - radius,
      start: 0,
    },
    {
      centerX: -halfWidth + radius,
      centerY: halfHeight - radius,
      start: Math.PI / 2,
    },
    {
      centerX: -halfWidth + radius,
      centerY: -halfHeight + radius,
      start: Math.PI,
    },
  ];

  return corners.flatMap(({ centerX, centerY, start }) =>
    Array.from({ length: CARD_CORNER_SEGMENTS + 1 }, (_, index) => {
      const angle = start + (Math.PI / 2) * (index / CARD_CORNER_SEGMENTS);
      const normalX = Math.cos(angle);
      const normalY = Math.sin(angle);
      return {
        normalX,
        normalY,
        x: centerX + normalX * radius,
        y: centerY + normalY * radius,
      };
    }),
  );
};

const makeCardGeometry = () => {
  const halfWidth = CARD_WORLD_WIDTH / 2;
  const halfHeight = CARD_WORLD_HEIGHT / 2;
  const frontZ = CARD_WORLD_DEPTH / 2;
  const backZ = -CARD_WORLD_DEPTH / 2;
  const contour = makeRoundedCardContour(
    CARD_WORLD_WIDTH,
    CARD_WORLD_HEIGHT,
    CARD_WORLD_RADIUS,
  );
  const contour2d = contour.map(({ x, y }) => new Vector2(x, y));
  const triangles = ShapeUtils.triangulateShape(contour2d, []);
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];

  const addVertex = (
    x: number,
    y: number,
    z: number,
    normalX: number,
    normalY: number,
    normalZ: number,
    u = 0,
    v = 0,
  ) => {
    positions.push(x, y, z);
    normals.push(normalX, normalY, normalZ);
    uvs.push(u, v);
  };
  const addFrontVertex = ({ x, y }: CardContourPoint) =>
    addVertex(
      x,
      y,
      frontZ,
      0,
      0,
      1,
      (x + halfWidth) / CARD_WORLD_WIDTH,
      (y + halfHeight) / CARD_WORLD_HEIGHT,
    );

  triangles.forEach(([a, b, c]) => {
    addFrontVertex(contour[a]);
    addFrontVertex(contour[b]);
    addFrontVertex(contour[c]);
  });
  const frontVertexCount = positions.length / 3;

  const profile: CardProfileRing[] = Array.from(
    { length: CARD_BEVEL_SEGMENTS + 1 },
    (_, index) => {
      const angle = (Math.PI / 2) * (index / CARD_BEVEL_SEGMENTS);
      const normalOutUnscaled = CARD_BEVEL_DEPTH * Math.sin(angle);
      const normalZUnscaled = CARD_BACK_OVERHANG * Math.cos(angle);
      const normalLength = Math.hypot(normalOutUnscaled, normalZUnscaled) || 1;
      return {
        expansion: CARD_BACK_OVERHANG * Math.sin(angle),
        normalOut: normalOutUnscaled / normalLength,
        normalZ: normalZUnscaled / normalLength,
        z: frontZ - CARD_BEVEL_DEPTH * (1 - Math.cos(angle)),
      };
    },
  );
  profile.push({
    expansion: CARD_BACK_OVERHANG,
    normalOut: 1,
    normalZ: 0,
    z: backZ,
  });

  const addProfileVertex = (point: CardContourPoint, ring: CardProfileRing) =>
    addVertex(
      point.x + point.normalX * ring.expansion,
      point.y + point.normalY * ring.expansion,
      ring.z,
      point.normalX * ring.normalOut,
      point.normalY * ring.normalOut,
      ring.normalZ,
    );

  for (let ringIndex = 0; ringIndex < profile.length - 1; ringIndex += 1) {
    const frontRing = profile[ringIndex];
    const backRing = profile[ringIndex + 1];
    for (let index = 0; index < contour.length; index += 1) {
      const next = (index + 1) % contour.length;
      addProfileVertex(contour[index], frontRing);
      addProfileVertex(contour[next], frontRing);
      addProfileVertex(contour[next], backRing);
      addProfileVertex(contour[index], frontRing);
      addProfileVertex(contour[next], backRing);
      addProfileVertex(contour[index], backRing);
    }
  }

  const backContour = contour.map((point) => ({
    ...point,
    x: point.x + point.normalX * CARD_BACK_OVERHANG,
    y: point.y + point.normalY * CARD_BACK_OVERHANG,
  }));
  triangles.forEach(([a, b, c]) => {
    [c, b, a].forEach((index) => {
      const { x, y } = backContour[index];
      addVertex(x, y, backZ, 0, 0, -1);
    });
  });

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.addGroup(0, frontVertexCount, 0);
  geometry.addGroup(frontVertexCount, positions.length / 3 - frontVertexCount, 1);
  geometry.computeBoundingSphere();
  return geometry;
};

const animationAt = (timestamp: number) => {
  const progress = (timestamp % ANIMATION_DURATION) / ANIMATION_DURATION;
  const scaled = progress * 4;
  const index = Math.min(3, Math.floor(scaled));
  const amount = easeInOut(scaled - index);
  const from = keyframes[index];
  const to = keyframes[index + 1];
  return Object.fromEntries(
    (Object.keys(from) as Array<keyof Transform>).map((key) => [
      key,
      mix(from[key], to[key], amount),
    ]),
  ) as Transform;
};

const makeRenderer = async (
  target: TelegramStoryTarget,
  locale: TelegramStoryLocale,
  logoUrl: string,
  theme: TelegramStoryTheme,
  onStage: (stage: Extract<StoryWorkerStage, "assets" | "scene-init">) => void,
) => {
  const palette = palettes[theme];
  onStage("assets");
  const [backgroundCanvas, cardCanvas] = await Promise.all([
    drawBackground(target, locale, logoUrl, theme),
    target.type === "contract"
      ? drawContractCard(target, locale, palette)
      : target.type === "profile"
        ? drawProfileCard(target, locale, palette)
        : Promise.resolve(drawReferralCard(target, locale, palette)),
  ]);
  onStage("scene-init");
  const canvas = new OffscreenCanvas(WIDTH, HEIGHT);
  const renderer = new WebGLRenderer({
    alpha: false,
    antialias: true,
    canvas: canvas as unknown as HTMLCanvasElement,
    premultipliedAlpha: true,
    preserveDrawingBuffer: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(1);
  renderer.setSize(WIDTH, HEIGHT, false);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = VSMShadowMap;

  const scene = new Scene();
  const camera = new PerspectiveCamera(31.5, WIDTH / HEIGHT, 0.1, 100);
  camera.position.set(0, 0, 18);
  camera.lookAt(0, 0, 0);

  const makeCanvasTexture = (textureCanvas: OffscreenCanvas) => {
    const texture = new CanvasTexture(
      textureCanvas as unknown as HTMLCanvasElement,
    );
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    return texture;
  };

  const backgroundTexture = makeCanvasTexture(backgroundCanvas);
  const cardTexture = makeCanvasTexture(cardCanvas);
  scene.background = backgroundTexture;

  const bokehTextures: CanvasTexture[] = [];
  const makeBokehSprite = ({
    color,
    opacity,
    softness,
  }: {
    color: [number, number, number];
    opacity: number;
    softness: number;
  }) => {
    const { canvas: bokehCanvas, context } = createCanvas(384, 384);
    const gradient = context.createRadialGradient(192, 192, 0, 192, 192, 192);
    const rgb = color.join(", ");
    gradient.addColorStop(0, `rgba(${rgb}, 0.92)`);
    gradient.addColorStop(softness, `rgba(${rgb}, 0.52)`);
    gradient.addColorStop(Math.min(0.86, softness + 0.34), `rgba(${rgb}, 0.16)`);
    gradient.addColorStop(1, `rgba(${rgb}, 0)`);
    context.fillStyle = gradient;
    context.fillRect(0, 0, bokehCanvas.width, bokehCanvas.height);
    const texture = makeCanvasTexture(bokehCanvas);
    bokehTextures.push(texture);
    return new Sprite(
      new SpriteMaterial({
        depthWrite: false,
        map: texture,
        opacity,
        toneMapped: false,
        transparent: true,
      }),
    );
  };

  const backBokehLeft = makeBokehSprite({
    color: [117, 247, 96],
    opacity: theme === "dark" ? 0.22 : 0.18,
    softness: 0.2,
  });
  backBokehLeft.position.set(-2.9, 2.35, -2.15);
  backBokehLeft.scale.setScalar(2.45);
  backBokehLeft.renderOrder = -1;
  scene.add(backBokehLeft);

  const backBokehRight = makeBokehSprite({
    color: theme === "dark" ? [255, 255, 255] : [175, 255, 154],
    opacity: theme === "dark" ? 0.12 : 0.16,
    softness: 0.38,
  });
  backBokehRight.position.set(3.15, -1.75, -2.55);
  backBokehRight.scale.setScalar(1.9);
  backBokehRight.renderOrder = -1;
  scene.add(backBokehRight);

  const backBokehTop = makeBokehSprite({
    color: [117, 247, 96],
    opacity: theme === "dark" ? 0.14 : 0.1,
    softness: 0.48,
  });
  backBokehTop.position.set(2.7, 3.15, -3.1);
  backBokehTop.scale.setScalar(1.35);
  backBokehTop.renderOrder = -1;
  scene.add(backBokehTop);

  const frontBokeh = makeBokehSprite({
    color: [117, 247, 96],
    opacity: theme === "dark" ? 0.16 : 0.12,
    softness: 0.55,
  });
  frontBokeh.position.set(-3.05, -2.7, 1.55);
  frontBokeh.scale.setScalar(3.25);
  frontBokeh.renderOrder = 3;
  scene.add(frontBokeh);

  const pmremGenerator = new PMREMGenerator(renderer);
  const roomEnvironment = new RoomEnvironment();
  const environmentTarget = pmremGenerator.fromScene(roomEnvironment, 0.04);
  scene.environment = environmentTarget.texture;
  roomEnvironment.dispose();
  pmremGenerator.dispose();

  scene.add(new AmbientLight(0xffffff, theme === "dark" ? 1.35 : 1.05));
  const keyLight = new DirectionalLight(0xffffff, 3.3);
  keyLight.position.set(-4.5, 7.5, 11);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.left = -7;
  keyLight.shadow.camera.right = 7;
  keyLight.shadow.camera.top = 8;
  keyLight.shadow.camera.bottom = -8;
  keyLight.shadow.camera.near = 2;
  keyLight.shadow.camera.far = 28;
  keyLight.shadow.bias = -0.0004;
  keyLight.shadow.normalBias = 0.025;
  keyLight.shadow.radius = 7;
  keyLight.shadow.blurSamples = 16;
  keyLight.target.position.set(0, CARD_WORLD_CENTER_Y, 0);
  scene.add(keyLight, keyLight.target);

  const fillLight = new DirectionalLight(palette.accent, 1.7);
  fillLight.position.set(5.5, -2.5, 6);
  scene.add(fillLight);

  const shadowReceiver = new Mesh(
    new PlaneGeometry(14, 16),
    new ShadowMaterial({
      color: new Color(theme === "dark" ? "#000000" : "#172016"),
      opacity: theme === "dark" ? 0.44 : 0.17,
      transparent: true,
      depthWrite: false,
    }),
  );
  shadowReceiver.position.set(0.12, CARD_WORLD_CENTER_Y - 0.08, -1.35);
  shadowReceiver.receiveShadow = true;
  scene.add(shadowReceiver);

  const cardRoot = new Group();
  const cardTilt = new Group();
  cardRoot.position.y = CARD_WORLD_CENTER_Y;
  cardRoot.add(cardTilt);
  scene.add(cardRoot);

  const cardEdgeMaterial = new MeshPhysicalMaterial({
    color: theme === "dark" ? "#000000" : "#ffffff",
    clearcoat: 0.62,
    clearcoatRoughness: 0.2,
    envMapIntensity: 1.45,
    metalness: 0.04,
    roughness: 0.3,
  });
  const cardFaceMaterial = new MeshBasicMaterial({
    alphaTest: 0.01,
    map: cardTexture,
    toneMapped: false,
    transparent: true,
  });
  const cardBody = new Mesh(
    makeCardGeometry(),
    [cardFaceMaterial, cardEdgeMaterial],
  );
  cardBody.castShadow = true;
  cardTilt.add(cardBody);

  return {
    canvas,
    render(timestamp: number) {
      const transform = animationAt(timestamp);
      const ambientPhase = (timestamp / ANIMATION_DURATION) * Math.PI * 2;
      backBokehLeft.position.x = -2.9 + Math.sin(ambientPhase) * 0.28;
      backBokehLeft.position.y = 2.35 + Math.cos(ambientPhase * 0.8) * 0.18;
      backBokehRight.position.x = 3.15 + Math.cos(ambientPhase * 0.7) * 0.24;
      backBokehRight.position.y = -1.75 + Math.sin(ambientPhase * 0.9) * 0.26;
      backBokehTop.position.x = 2.7 + Math.sin(ambientPhase * 0.55) * 0.2;
      backBokehTop.position.y = 3.15 + Math.cos(ambientPhase * 0.65) * 0.16;
      frontBokeh.position.x = -3.05 + Math.cos(ambientPhase * 0.45) * 0.2;
      frontBokeh.position.y = -2.7 + Math.sin(ambientPhase * 0.5) * 0.16;
      cardRoot.position.set(
        transform.tx / PIXELS_PER_WORLD_UNIT,
        CARD_WORLD_CENTER_Y - transform.ty / PIXELS_PER_WORLD_UNIT,
        transform.tz / PIXELS_PER_WORLD_UNIT,
      );
      cardRoot.rotation.z = degrees(transform.rz);
      cardTilt.rotation.set(
        degrees(transform.rx),
        degrees(transform.ry),
        0,
        "YXZ",
      );
      renderer.render(scene, camera);
      renderer.getContext().finish();
    },
    dispose() {
      scene.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        object.geometry.dispose();
        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material];
        new Set(materials).forEach((material) => material.dispose());
      });
      backgroundTexture.dispose();
      cardTexture.dispose();
      bokehTextures.forEach((texture) => texture.dispose());
      [backBokehLeft, backBokehRight, backBokehTop, frontBokeh].forEach(
        (sprite) => sprite.material.dispose(),
      );
      environmentTarget.dispose();
      renderer.dispose();
    },
  };
};

const addAudio = async (source: AudioSampleSource, audio: StoryAudio) => {
  const chunkFrames = audio.sampleRate;
  for (let offset = 0; offset < audio.length; offset += chunkFrames) {
    const frameCount = Math.min(chunkFrames, audio.length - offset);
    const interleaved = new Float32Array(frameCount * audio.channels.length);
    for (let frame = 0; frame < frameCount; frame += 1) {
      for (let channel = 0; channel < audio.channels.length; channel += 1) {
        interleaved[frame * audio.channels.length + channel] = audio.channels[channel][offset + frame];
      }
    }
    const sample = new AudioSample({
      data: interleaved,
      format: "f32",
      numberOfChannels: audio.channels.length,
      sampleRate: audio.sampleRate,
      timestamp: offset / audio.sampleRate,
    });
    await source.add(sample);
    sample.close();
  }
};

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<ExportMessage>) => void) | null;
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
};

workerScope.onmessage = async (event) => {
  if (event.data?.type !== "export") return;
  let storyRenderer: Awaited<ReturnType<typeof makeRenderer>> | undefined;
  let stage: StoryWorkerStage = "fonts";
  let currentFrame: number | undefined;
  try {
    const { target, locale, theme, logoUrl, fontUrls, audio } = event.data;
    await loadBrandFonts(fontUrls);
    storyRenderer = await makeRenderer(target, locale, logoUrl, theme, (nextStage) => {
      stage = nextStage;
    });
    stage = "encoder-init";
    const targetBuffer = new BufferTarget();
    const output = new Output({
      format: new Mp4OutputFormat({ fastStart: "in-memory" }),
      target: targetBuffer,
    });
    const videoSource = new CanvasSource(storyRenderer.canvas, {
      codec: "avc",
      fullCodecString: "avc1.64002a",
      quality: new Quality({ bitrate: 16_000_000, quantizer: 10, bitrateMode: "variable" }),
      latencyMode: "quality",
      keyFrameInterval: 2,
      contentHint: "detail",
    });
    const audioSource = new AudioSampleSource({
      codec: "aac",
      quality: new Quality({ bitrate: 192_000, bitrateMode: "constant" }),
    });
    output.addVideoTrack(videoSource, { name: "Favor story" });
    output.addAudioTrack(audioSource, { name: "Favor audio" });
    await output.start();

    const duration = audio.length / audio.sampleRate;
    const frameCount = Math.ceil(duration * FRAME_RATE);
    stage = "render";
    for (let frame = 0; frame < frameCount; frame += 1) {
      currentFrame = frame;
      const timestamp = frame / FRAME_RATE;
      storyRenderer.render(timestamp);
      await videoSource.add(timestamp, FRAME_DURATION, {
        keyFrame: frame % (FRAME_RATE * 2) === 0,
      });
      if (frame % 30 === 0 || frame === frameCount - 1) {
        workerScope.postMessage({ type: "progress", frame, frameCount });
      }
    }
    stage = "audio";
    await addAudio(audioSource, audio);
    stage = "finalize";
    await output.finalize();
    const buffer = targetBuffer.buffer;
    if (!buffer) throw new Error("MP4 buffer is empty");
    workerScope.postMessage({ type: "done", buffer }, [buffer]);
  } catch (error) {
    workerScope.postMessage({
      type: "error",
      code: errorCodeByStage[stage],
      stage,
      frame: currentFrame,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  } finally {
    storyRenderer?.dispose();
  }
};
