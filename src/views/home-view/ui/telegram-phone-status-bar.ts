import {
  TELEGRAM_SCREEN_LAYOUT,
  TELEGRAM_SCREEN_THEME,
} from "./telegram-phone-chat-theme";

export function formatTelegramPhoneTime(date: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function drawTelegramPhoneStatusBar(
  context: CanvasRenderingContext2D,
  time: string,
) {
  context.save();
  context.textBaseline = "middle";
  context.fillStyle = TELEGRAM_SCREEN_THEME.statusBar;
  context.fillRect(
    0,
    0,
    TELEGRAM_SCREEN_LAYOUT.width,
    TELEGRAM_SCREEN_LAYOUT.statusBarHeight,
  );

  context.font = "700 11px Montserrat, Arial, sans-serif";
  context.fillStyle = "#ffffff";
  context.fillText(time, 20, 25);

  context.beginPath();
  context.roundRect(132, 8, 96, 28, 15);
  context.fillStyle = "#000000";
  context.fill();

  drawStatusIcons(context);
  context.restore();
}

function drawStatusIcons(context: CanvasRenderingContext2D) {
  context.fillStyle = "rgba(255,255,255,0.88)";
  context.fillRect(288, 27, 3, 5);
  context.fillRect(293, 24, 3, 8);
  context.fillRect(298, 21, 3, 11);

  context.strokeStyle = "rgba(255,255,255,0.88)";
  context.lineWidth = 1.5;
  context.beginPath();
  context.arc(312, 29, 8, Math.PI * 1.18, Math.PI * 1.82);
  context.stroke();
  context.beginPath();
  context.arc(312, 29, 4.5, Math.PI * 1.18, Math.PI * 1.82);
  context.stroke();
  context.fillRect(311, 29, 2, 2);

  context.strokeRect(326, 22, 18, 10);
  context.fillRect(344, 25, 2, 4);
  context.fillRect(328, 24, 13, 6);
}
