const RICH_MESSAGE_URL_BUTTON_STYLES = new Set([
  "default",
  "primary",
  "success",
]);
const RICH_MESSAGE_URL_PROTOCOLS = new Set(["http:", "https:", "tg:"]);
const RICH_MESSAGE_BUTTONS_PER_ROW_LIMIT = 8;

function escapeRichMessageHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function assertRichMessageButtonUrl(value) {
  let url;

  try {
    url = new URL(value);
  } catch {
    throw new TypeError("Rich message button URL must be absolute");
  }

  if (!RICH_MESSAGE_URL_PROTOCOLS.has(url.protocol)) {
    throw new TypeError("Rich message button URL uses an unsupported protocol");
  }
}

function buildCenteredRichMessageUrlButtonRow(buttons) {
  if (!Array.isArray(buttons)) {
    throw new TypeError("Rich message buttons must be an array");
  }

  if (buttons.length === 0) {
    return "";
  }

  if (buttons.length > RICH_MESSAGE_BUTTONS_PER_ROW_LIMIT) {
    throw new RangeError(
      `Rich message button rows support at most ${RICH_MESSAGE_BUTTONS_PER_ROW_LIMIT} buttons`,
    );
  }

  const renderedButtons = buttons.map((button) => {
    const text = String(button?.text || "").trim();
    const url = String(button?.url || "").trim();
    const style = button?.style || "default";

    if (!text) {
      throw new TypeError("Rich message button text is required");
    }

    if (!url) {
      throw new TypeError("Rich message button URL is required");
    }

    if (!RICH_MESSAGE_URL_BUTTON_STYLES.has(style)) {
      throw new TypeError(`Unsupported rich message button style: ${style}`);
    }

    assertRichMessageButtonUrl(url);
    const styleAttribute = style === "default" ? "" : ` style="${style}"`;

    return `<tg-button type="url"${styleAttribute} url="${escapeRichMessageHtml(url)}">${escapeRichMessageHtml(text)}</tg-button>`;
  });

  return `<tg-button-row align="center">${renderedButtons.join("")}</tg-button-row>`;
}

module.exports = {
  buildCenteredRichMessageUrlButtonRow,
};
