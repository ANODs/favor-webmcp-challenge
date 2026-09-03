const TELEGRAM_RICH_MESSAGE_BUTTONS_PER_ROW_LIMIT = 8;
const TELEGRAM_RICH_MESSAGE_URL_PROTOCOLS = new Set(["http:", "https:", "tg:"]);
const TELEGRAM_RICH_MESSAGE_URL_BUTTON_STYLES = new Set([
  "primary",
  "success",
]);

export type TelegramRichMessageUrlButtonStyle = "primary" | "success";

export type TelegramRichMessageUrlButton = {
  text: string;
  url: string;
  style?: TelegramRichMessageUrlButtonStyle;
};

const escapeRichMessageHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const assertRichMessageButtonUrl = (value: string) => {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new TypeError("Rich message button URL must be absolute");
  }

  if (!TELEGRAM_RICH_MESSAGE_URL_PROTOCOLS.has(url.protocol)) {
    throw new TypeError("Rich message button URL uses an unsupported protocol");
  }
};

export function buildCenteredTelegramRichMessageUrlButtonRow(
  buttons: readonly TelegramRichMessageUrlButton[],
) {
  if (buttons.length === 0) {
    return "";
  }

  if (buttons.length > TELEGRAM_RICH_MESSAGE_BUTTONS_PER_ROW_LIMIT) {
    throw new RangeError(
      `Rich message button rows support at most ${TELEGRAM_RICH_MESSAGE_BUTTONS_PER_ROW_LIMIT} buttons`,
    );
  }

  const renderedButtons = buttons.map((button) => {
    const text = button.text.trim();
    const url = button.url.trim();

    if (!text) {
      throw new TypeError("Rich message button text is required");
    }

    if (!url) {
      throw new TypeError("Rich message button URL is required");
    }

    if (
      button.style &&
      !TELEGRAM_RICH_MESSAGE_URL_BUTTON_STYLES.has(button.style)
    ) {
      throw new TypeError(`Unsupported rich message button style: ${button.style}`);
    }

    assertRichMessageButtonUrl(url);
    const styleAttribute = button.style ? ` style="${button.style}"` : "";

    return `<tg-button type="url"${styleAttribute} url="${escapeRichMessageHtml(url)}">${escapeRichMessageHtml(text)}</tg-button>`;
  });

  return `<tg-button-row align="center">${renderedButtons.join("")}</tg-button-row>`;
}
