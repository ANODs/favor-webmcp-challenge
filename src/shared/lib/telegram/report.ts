"use client";

import { buildReportStartParam, buildTelegramBotStartUrl } from "./links";
import { openTelegramLink } from "./webapp";

const DEFAULT_BOT_USERNAME = "FavorDealsBot";

const getBotUsername = () =>
  document.body.dataset.telegramBotUsername || DEFAULT_BOT_USERNAME;

export function openTelegramProblemReport(errorDigest?: string | null) {
  const url = buildTelegramBotStartUrl(
    getBotUsername(),
    buildReportStartParam(errorDigest),
  );

  openTelegramLink(url);
}
