"use client";

import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";

import {
  TELEGRAM_SCREEN_LAYOUT,
  TELEGRAM_SCREEN_THEME,
} from "./telegram-phone-chat-theme";
import {
  drawTelegramPhoneStatusBar,
  formatTelegramPhoneTime,
} from "./telegram-phone-status-bar";

const MESSAGE_ANIMATION_SECONDS = 5.4;

export const TELEGRAM_SCREEN_CONTRACT_BUTTON = {
  height: 48,
  width: 320,
  x: 28,
  y: 578,
} as const;

export type TelegramScreenCopy = {
  clientName: string;
  lastSeen: string;
  message1: string;
  message2: string;
  contractTitle: string;
  category: string;
  budget: string;
  deadline: string;
  published: string;
  openContract: string;
  inputPlaceholder: string;
};

type ScreenTextureOptions = {
  accentColor: string;
  copy: TelegramScreenCopy;
  locale: string;
};

export function useTelegramScreenTexture({ accentColor, copy, locale }: ScreenTextureOptions) {
  const [ready, setReady] = useState(false);
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = TELEGRAM_SCREEN_LAYOUT.width * 2;
    canvas.height = TELEGRAM_SCREEN_LAYOUT.height * 2;

    const nextTexture = new THREE.CanvasTexture(canvas);
    nextTexture.colorSpace = THREE.SRGBColorSpace;
    nextTexture.anisotropy = 8;
    nextTexture.minFilter = THREE.LinearMipmapLinearFilter;
    nextTexture.magFilter = THREE.LinearFilter;
    return nextTexture;
  }, []);

  useEffect(() => {
    const canvas = texture.image as HTMLCanvasElement;
    const logo = new Image();
    let active = true;
    let logoReady = false;
    let animationFrameId = 0;
    let didReportFirstDraw = false;
    const animationStartedAt = performance.now();

    const redraw = (timestamp = performance.now()) => {
      if (!active) return;

      const didDraw = drawTelegramScreen(canvas, {
        accentColor,
        animationSeconds: Math.min((timestamp - animationStartedAt) / 1000, MESSAGE_ANIMATION_SECONDS),
        copy,
        locale,
        logo: logoReady ? logo : null,
        now: new Date(),
      });
      // Three.js textures are mutable GPU resources; this uploads the redrawn canvas.
      texture.needsUpdate = true;
      if (didDraw && !didReportFirstDraw) {
        didReportFirstDraw = true;
        setReady(true);
      }
    };

    const animate = (timestamp: number) => {
      redraw(timestamp);
      if ((timestamp - animationStartedAt) / 1000 < MESSAGE_ANIMATION_SECONDS) {
        animationFrameId = window.requestAnimationFrame(animate);
      }
    };

    logo.decoding = "async";
    logo.onload = () => {
      logoReady = true;
      redraw();
    };
    logo.src = "/logo.svg";

    animationFrameId = window.requestAnimationFrame(animate);
    void document.fonts.ready.then(() => redraw());
    const intervalId = window.setInterval(redraw, 1_000);

    return () => {
      active = false;
      logo.onload = null;
      window.cancelAnimationFrame(animationFrameId);
      window.clearInterval(intervalId);
    };
  }, [accentColor, copy, locale, texture]);

  useEffect(() => () => texture.dispose(), [texture]);

  return { ready, texture };
}

function drawTelegramScreen(
  canvas: HTMLCanvasElement,
  {
    accentColor,
    copy,
    locale,
    logo,
    now,
    animationSeconds,
  }: ScreenTextureOptions & {
    animationSeconds: number;
    logo: HTMLImageElement | null;
    now: Date;
  },
) {
  const context = canvas.getContext("2d");
  if (!context) return false;

  context.resetTransform();
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.scale(2, 2);
  context.textBaseline = "middle";
  context.save();
  context.beginPath();
  context.roundRect(
    0,
    0,
    TELEGRAM_SCREEN_LAYOUT.width,
    TELEGRAM_SCREEN_LAYOUT.height,
    32,
  );
  context.clip();

  const currentTime = formatTelegramPhoneTime(now, locale);

  context.fillStyle = TELEGRAM_SCREEN_THEME.surface;
  context.fillRect(
    0,
    0,
    TELEGRAM_SCREEN_LAYOUT.width,
    TELEGRAM_SCREEN_LAYOUT.height,
  );

  drawTelegramPhoneStatusBar(context, currentTime);

  context.fillStyle = TELEGRAM_SCREEN_THEME.header;
  context.fillRect(
    0,
    TELEGRAM_SCREEN_LAYOUT.statusBarHeight,
    TELEGRAM_SCREEN_LAYOUT.width,
    TELEGRAM_SCREEN_LAYOUT.headerHeight,
  );
  context.fillStyle = TELEGRAM_SCREEN_THEME.divider;
  context.fillRect(
    0,
    TELEGRAM_SCREEN_LAYOUT.statusBarHeight +
      TELEGRAM_SCREEN_LAYOUT.headerHeight -
      1,
    TELEGRAM_SCREEN_LAYOUT.width,
    1,
  );
  if (logo) {
    context.drawImage(logo, 16, 69, 30, 30);
  } else {
    drawText(context, "F", 20, 84, 22, 800, "#ffffff");
  }
  drawText(context, copy.clientName, 58, 80, 15, 700, "#ffffff");
  drawText(context, copy.lastSeen, 58, 101, 12, 600, TELEGRAM_SCREEN_THEME.accent);
  roundedFill(context, 316, 68, 30, 30, 15, "rgba(255,255,255,0.05)");
  context.fillStyle = "#8a8b92";
  for (let index = 0; index < 3; index += 1) context.fillRect(325 + index * 5, 82, 2, 2);

  context.fillStyle = TELEGRAM_SCREEN_THEME.surface;
  context.fillRect(
    0,
    TELEGRAM_SCREEN_LAYOUT.statusBarHeight + TELEGRAM_SCREEN_LAYOUT.headerHeight,
    TELEGRAM_SCREEN_LAYOUT.width,
    TELEGRAM_SCREEN_LAYOUT.chatBodyHeight,
  );
  context.fillStyle = "rgba(255,255,255,0.045)";
  for (
    let y =
      TELEGRAM_SCREEN_LAYOUT.statusBarHeight +
      TELEGRAM_SCREEN_LAYOUT.headerHeight +
      12;
    y < TELEGRAM_SCREEN_LAYOUT.height - TELEGRAM_SCREEN_LAYOUT.composerHeight - 8;
    y += 16
  ) {
    for (let x = 8; x < TELEGRAM_SCREEN_LAYOUT.width; x += 16) {
      context.fillRect(x, y, 1, 1);
    }
  }

  drawTypingIndicator(
    context,
    animationSeconds,
    0.08,
    0.9,
    12,
    137,
    TELEGRAM_SCREEN_THEME.incoming,
  );

  drawRevealed(context, animationSeconds, 0.9, { x: 12, y: 137, width: 278, height: 98 }, () => {
    roundedFill(context, 12, 137, 278, 98, 17, TELEGRAM_SCREEN_THEME.incoming);
    drawWrappedText(context, copy.message1, 26, 157, 238, 14, 19, 500, "#f4f4f5");
    drawText(context, currentTime, 250, 218, 10, 600, "#71717a");
  });

  drawTypingIndicator(
    context,
    animationSeconds,
    1.52,
    2.22,
    280,
    252,
    TELEGRAM_SCREEN_THEME.outgoingStart,
  );

  drawRevealed(context, animationSeconds, 2.22, { x: 72, y: 252, width: 276, height: 102 }, () => {
    const replyGradient = context.createLinearGradient(72, 252, 348, 354);
    replyGradient.addColorStop(0, TELEGRAM_SCREEN_THEME.outgoingStart);
    replyGradient.addColorStop(1, TELEGRAM_SCREEN_THEME.outgoingEnd);
    roundedFill(context, 72, 252, 276, 102, 17, replyGradient);
    drawWrappedText(context, copy.message2, 88, 273, 232, 14, 19, 500, "#ffffff");
    drawText(context, `${currentTime}  ✓✓`, 288, 338, 10, 600, "rgba(255,255,255,0.68)");
  });

  drawTypingIndicator(
    context,
    animationSeconds,
    2.85,
    3.55,
    280,
    370,
    TELEGRAM_SCREEN_THEME.outgoingStart,
  );

  drawRevealed(context, animationSeconds, 3.55, { x: 28, y: 370, width: 320, height: 201 }, () => {
    const cardGradient = context.createLinearGradient(28, 370, 348, 570);
    cardGradient.addColorStop(0, "#24209e");
    cardGradient.addColorStop(1, "#3d2bc8");
    roundedFill(context, 28, 370, 320, 201, 17, cardGradient);
    drawText(context, "via @FavorDealsBot", 44, 390, 11, 600, "rgba(255,255,255,0.62)");
    drawText(context, copy.contractTitle, 44, 420, 16, 800, "#ffffff");
    drawBulletLine(context, copy.category, 44, 454, accentColor);
    drawBulletLine(context, copy.budget, 44, 479, "#76a9ff");
    drawBulletLine(context, copy.deadline, 44, 504, "#d589ff");
    drawText(context, copy.published, 44, 543, 10, 600, "rgba(255,255,255,0.56)");
    drawText(context, `${currentTime}  ✓✓`, 286, 543, 10, 600, "rgba(255,255,255,0.62)");
  });

  drawRevealed(context, animationSeconds, 3.92, TELEGRAM_SCREEN_CONTRACT_BUTTON, () => {
    roundedFill(
      context,
      TELEGRAM_SCREEN_CONTRACT_BUTTON.x,
      TELEGRAM_SCREEN_CONTRACT_BUTTON.y,
      TELEGRAM_SCREEN_CONTRACT_BUTTON.width,
      TELEGRAM_SCREEN_CONTRACT_BUTTON.height,
      16,
      accentColor,
    );
    context.textAlign = "center";
    drawText(context, copy.openContract, 188, 602, 14, 800, "#050505");
    context.textAlign = "left";
  });

  context.fillStyle = TELEGRAM_SCREEN_THEME.header;
  const composerY =
    TELEGRAM_SCREEN_LAYOUT.height - TELEGRAM_SCREEN_LAYOUT.composerHeight;
  context.fillRect(
    0,
    composerY,
    TELEGRAM_SCREEN_LAYOUT.width,
    TELEGRAM_SCREEN_LAYOUT.composerHeight,
  );
  context.fillStyle = TELEGRAM_SCREEN_THEME.divider;
  context.fillRect(0, composerY, TELEGRAM_SCREEN_LAYOUT.width, 1);
  drawPaperclip(context, 18, 689);
  roundedFill(context, 42, 670, 260, 40, 20, TELEGRAM_SCREEN_THEME.composerInput);
  drawText(context, copy.inputPlaceholder, 58, 690, 14, 500, TELEGRAM_SCREEN_THEME.muted);
  roundedFill(context, 310, 670, 40, 40, 20, TELEGRAM_SCREEN_THEME.composerSend);
  drawSendArrow(context, 330, 690);
  context.restore();
  return true;
}

type RevealBounds = {
  height: number;
  width: number;
  x: number;
  y: number;
};

function drawRevealed(
  context: CanvasRenderingContext2D,
  elapsedSeconds: number,
  delaySeconds: number,
  bounds: RevealBounds,
  draw: () => void,
) {
  const progress = THREE.MathUtils.clamp((elapsedSeconds - delaySeconds) / 0.48, 0, 1);
  if (progress <= 0) return;

  const eased = 1 - Math.pow(1 - progress, 3);
  const back = 1 + 1.5 * Math.pow(progress - 1, 3) + 0.5 * Math.pow(progress - 1, 2);
  const scale = 0.96 + back * 0.04;
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;

  context.save();
  context.globalAlpha *= eased;
  context.translate(centerX, centerY + (1 - eased) * 16);
  context.scale(scale, scale);
  context.translate(-centerX, -centerY);
  draw();
  context.restore();
}

function drawTypingIndicator(
  context: CanvasRenderingContext2D,
  elapsedSeconds: number,
  startSeconds: number,
  endSeconds: number,
  x: number,
  y: number,
  fill: string,
) {
  if (elapsedSeconds < startSeconds || elapsedSeconds > endSeconds) return;

  const fadeIn = THREE.MathUtils.clamp((elapsedSeconds - startSeconds) / 0.12, 0, 1);
  const fadeOut = THREE.MathUtils.clamp((endSeconds - elapsedSeconds) / 0.12, 0, 1);
  const opacity = Math.min(fadeIn, fadeOut);

  context.save();
  context.globalAlpha *= opacity;
  roundedFill(context, x, y, 68, 38, 19, fill);
  for (let index = 0; index < 3; index += 1) {
    const pulse = 0.42 + 0.58 * Math.max(0, Math.sin((elapsedSeconds - startSeconds) * 10 - index * 0.9));
    context.globalAlpha = opacity * pulse;
    context.fillStyle = "#ffffff";
    context.beginPath();
    context.arc(x + 22 + index * 12, y + 19, 3, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawBulletLine(context: CanvasRenderingContext2D, text: string, x: number, y: number, color: string) {
  context.fillStyle = color;
  context.beginPath();
  context.arc(x + 3, y, 3, 0, Math.PI * 2);
  context.fill();
  drawText(context, text, x + 15, y, 12, 500, "rgba(255,255,255,0.86)");
}

function drawPaperclip(context: CanvasRenderingContext2D, x: number, y: number) {
  context.strokeStyle = "#71717a";
  context.lineWidth = 2;
  context.beginPath();
  context.arc(x, y, 7, 0.6, 5.6);
  context.arc(x, y, 4, 5.6, 0.6, true);
  context.stroke();
}

function drawSendArrow(context: CanvasRenderingContext2D, x: number, y: number) {
  context.fillStyle = "#ffffff";
  context.beginPath();
  context.moveTo(x - 7, y - 7);
  context.lineTo(x + 8, y);
  context.lineTo(x - 7, y + 7);
  context.lineTo(x - 3, y);
  context.closePath();
  context.fill();
}

function drawWrappedText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  fontSize: number,
  lineHeight: number,
  weight: number,
  color: string,
) {
  context.font = `${weight} ${fontSize}px Montserrat, Arial, sans-serif`;
  context.fillStyle = color;
  const words = text.split(/\s+/);
  let line = "";
  let currentY = y;

  for (const word of words) {
    const nextLine = line ? `${line} ${word}` : word;
    if (context.measureText(nextLine).width > maxWidth && line) {
      context.fillText(line, x, currentY);
      line = word;
      currentY += lineHeight;
    } else {
      line = nextLine;
    }
  }
  if (line) context.fillText(line, x, currentY);
}

function drawText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fontSize: number,
  weight: number,
  color: string,
) {
  context.font = `${weight} ${fontSize}px Montserrat, Arial, sans-serif`;
  context.fillStyle = color;
  context.fillText(text, x, y);
}

function roundedFill(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill: string | CanvasGradient,
) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.fillStyle = fill;
  context.fill();
}
