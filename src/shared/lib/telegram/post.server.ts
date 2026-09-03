import { load } from "cheerio";
import { proxyFetch } from "./proxy-fetch";
import { parseTelegramPostUrl } from "./post";

import type { TelegramInlineKeyboard } from "./bot";

type TelegramPostPreview = {
  telegramPostUrl: string;
  telegramChannelUrl: string;
  description: string;
  images: string[];
};

export type TelegramPostSnapshot = {
  plainText: string;
  inlineKeyboard: TelegramInlineKeyboard;
  isInlineKeyboardComplete: boolean;
  isMediaGroup: boolean;
  mediaGroupMessageIds: number[];
  caption: TelegramPostCaption;
  showCaptionAboveMedia: boolean;
};

export type TelegramPostCaption = {
  html: string;
  plainText: string;
  links: string[];
};

export type TelegramCaptionLinkAppendResult =
  | { status: "updated"; html: string }
  | { status: "unchanged"; html: string }
  | { status: "invalid_url" }
  | { status: "too_long" };

const TELEGRAM_INLINE_BUTTON_SELECTOR = ".tgme_widget_message_inline_button";
const TELEGRAM_INLINE_ROW_SELECTOR = ".tgme_widget_message_inline_keyboard_row";
const TELEGRAM_INLINE_KEYBOARD_MAX_BUTTONS = 100;
const TELEGRAM_GROUPED_MEDIA_SELECTOR =
  ".tgme_widget_message_grouped_wrap .grouped_media_wrap";
const TELEGRAM_CAPTION_MAX_LENGTH = 1024;

type TelegramHtmlNode = {
  type: string;
  data?: string;
  name?: string;
  tagName?: string;
  attribs?: Record<string, string>;
  children?: TelegramHtmlNode[];
};

const extractUrlFromStyle = (styleValue?: string) => {
  if (!styleValue) {
    return null;
  }

  const match = styleValue.match(/url\((['"]?)(.*?)\1\)/i);
  return match?.[2] ?? null;
};

const normalizeTelegramButtonUrl = (value?: string) => {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value, "https://t.me");

    if (!new Set(["http:", "https:", "tg:"]).has(url.protocol)) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
};

const normalizeTelegramCaptionUrl = (value?: string) => {
  if (!value || !/^(?:https?|tg):/i.test(value)) {
    return null;
  }

  return normalizeTelegramButtonUrl(value);
};

const normalizeTelegramButtonText = (value: string) =>
  Array.from(value.replace(/\s+/g, " ").trim()).slice(0, 64).join("");

const escapeTelegramHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const getTelegramHtmlNodeText = (node: TelegramHtmlNode): string => {
  if (node.type === "text") {
    return node.data ?? "";
  }

  const tagName = (node.name ?? node.tagName ?? "").toLowerCase();
  if (tagName === "br") {
    return "\n";
  }

  return (node.children ?? []).map(getTelegramHtmlNodeText).join("");
};

const serializeTelegramHtmlNode = (
  node: TelegramHtmlNode,
  links: Set<string>,
): string => {
  if (node.type === "text") {
    return escapeTelegramHtml(node.data ?? "");
  }

  if (node.type !== "tag") {
    return "";
  }

  const tagName = (node.name ?? node.tagName ?? "").toLowerCase();
  const classNames = new Set((node.attribs?.class ?? "").split(/\s+/).filter(Boolean));

  if (classNames.has("emoji")) {
    return escapeTelegramHtml(getTelegramHtmlNodeText(node));
  }

  if (tagName === "br") {
    return "\n";
  }

  const content = (node.children ?? [])
    .map((child) => serializeTelegramHtmlNode(child, links))
    .join("");

  switch (tagName) {
    case "b":
    case "strong":
      return `<b>${content}</b>`;
    case "i":
    case "em":
      return `<i>${content}</i>`;
    case "u":
    case "ins":
      return `<u>${content}</u>`;
    case "s":
    case "strike":
    case "del":
      return `<s>${content}</s>`;
    case "tg-spoiler":
      return `<tg-spoiler>${content}</tg-spoiler>`;
    case "span":
      return classNames.has("tg-spoiler")
        ? `<tg-spoiler>${content}</tg-spoiler>`
        : content;
    case "code": {
      const languageClass = node.attribs?.class?.match(/(?:^|\s)language-([\w+-]+)/)?.[1];
      return languageClass
        ? `<code class="language-${escapeTelegramHtml(languageClass)}">${content}</code>`
        : `<code>${content}</code>`;
    }
    case "pre":
      return `<pre>${content}</pre>`;
    case "blockquote":
      return node.attribs && "expandable" in node.attribs
        ? `<blockquote expandable>${content}</blockquote>`
        : `<blockquote>${content}</blockquote>`;
    case "tg-emoji": {
      const emojiId = node.attribs?.["emoji-id"];
      return emojiId && /^\d+$/.test(emojiId)
        ? `<tg-emoji emoji-id="${emojiId}">${content}</tg-emoji>`
        : content;
    }
    case "a": {
      const url = normalizeTelegramCaptionUrl(node.attribs?.href);
      if (!url) {
        return content;
      }

      links.add(url);
      return `<a href="${escapeTelegramHtml(url)}">${content}</a>`;
    }
    default:
      return content;
  }
};

export const extractTelegramPostCaption = (html: string): TelegramPostCaption => {
  const $ = load(html);
  const messageRoot = $(".tgme_widget_message").first();
  const scopedRoot = messageRoot.length > 0 ? messageRoot : $("body");
  const captionNode = scopedRoot.find(".tgme_widget_message_text").last();

  if (captionNode.length === 0) {
    return { html: "", plainText: "", links: [] };
  }

  const nodes = captionNode.contents().toArray() as unknown as TelegramHtmlNode[];
  const links = new Set<string>();
  const captionHtml = nodes
    .map((node) => serializeTelegramHtmlNode(node, links))
    .join("")
    .trim();
  const plainText = nodes.map(getTelegramHtmlNodeText).join("").trim();

  return { html: captionHtml, plainText, links: Array.from(links) };
};

export const appendTelegramCaptionLink = ({
  caption,
  text,
  url,
}: {
  caption: TelegramPostCaption;
  text: string;
  url: string;
}): TelegramCaptionLinkAppendResult => {
  const normalizedUrl = normalizeTelegramButtonUrl(url);
  if (!normalizedUrl) {
    return { status: "invalid_url" };
  }

  if (caption.links.includes(normalizedUrl)) {
    return { status: "unchanged", html: caption.html };
  }

  const normalizedText = text.replace(/\s+/g, " ").trim();
  const separator = caption.plainText ? "\n\n" : "";
  const callToActionText = `🔗 ${normalizedText}`;
  const nextLength = Array.from(
    `${caption.plainText}${separator}${callToActionText}`,
  ).length;

  if (!normalizedText || nextLength > TELEGRAM_CAPTION_MAX_LENGTH) {
    return { status: "too_long" };
  }

  return {
    status: "updated",
    html: `${caption.html}${separator}🔗 <a href="${escapeTelegramHtml(normalizedUrl)}">${escapeTelegramHtml(normalizedText)}</a>`,
  };
};

export const extractTelegramInlineKeyboard = (
  html: string,
): Pick<TelegramPostSnapshot, "inlineKeyboard" | "isInlineKeyboardComplete"> => {
  const $ = load(html);
  const messageRoot = $(".tgme_widget_message").first();
  const scopedRoot = messageRoot.length > 0 ? messageRoot : $("body");
  const buttonNodes = scopedRoot.find(TELEGRAM_INLINE_BUTTON_SELECTOR);

  if (buttonNodes.length === 0) {
    return { inlineKeyboard: [], isInlineKeyboardComplete: true };
  }

  const parseButtons = (nodes: ReturnType<typeof scopedRoot.find>) => {
    const buttons: Array<{ text: string; url: string }> = [];

    nodes.each((_, element) => {
      const node = $(element);
      const text = normalizeTelegramButtonText(node.text());
      const url = normalizeTelegramButtonUrl(node.attr("href"));

      if (text && url) {
        buttons.push({ text, url });
      }
    });

    return buttons;
  };

  const inlineKeyboard: TelegramInlineKeyboard = [];
  let parsedButtons = 0;
  const rowNodes = scopedRoot.find(TELEGRAM_INLINE_ROW_SELECTOR);

  if (rowNodes.length > 0) {
    rowNodes.each((_, rowElement) => {
      const row = parseButtons($(rowElement).find(TELEGRAM_INLINE_BUTTON_SELECTOR));

      parsedButtons += row.length;
      if (row.length > 0) {
        inlineKeyboard.push(row);
      }
    });
  } else {
    const buttons = parseButtons(buttonNodes);

    parsedButtons = buttons.length;
    inlineKeyboard.push(...buttons.map((button) => [button]));
  }

  return {
    inlineKeyboard,
    isInlineKeyboardComplete:
      parsedButtons === buttonNodes.length &&
      parsedButtons <= TELEGRAM_INLINE_KEYBOARD_MAX_BUTTONS,
  };
};

export const isTelegramMediaGroupPost = (html: string) => {
  const $ = load(html);
  const messageRoot = $(".tgme_widget_message").first();
  const scopedRoot = messageRoot.length > 0 ? messageRoot : $("body");

  return scopedRoot.find(TELEGRAM_GROUPED_MEDIA_SELECTOR).length > 1;
};

export const extractTelegramMediaGroupMessageIds = (html: string) => {
  const $ = load(html);
  const messageRoot = $(".tgme_widget_message").first();
  const scopedRoot = messageRoot.length > 0 ? messageRoot : $("body");
  const messageIds = new Set<number>();

  scopedRoot.find(TELEGRAM_GROUPED_MEDIA_SELECTOR).each((_, element) => {
    const href = $(element).attr("href");
    if (!href) {
      return;
    }

    try {
      const segments = new URL(href, "https://t.me").pathname.split("/").filter(Boolean);
      const messageId = Number(segments.at(-1));

      if (Number.isSafeInteger(messageId) && messageId > 0) {
        messageIds.add(messageId);
      }
    } catch {
      // A malformed media link must not prevent the caption fallback.
    }
  });

  return Array.from(messageIds);
};

const isTelegramCaptionAboveMedia = (html: string) => {
  const $ = load(html);
  const messageRoot = $(".tgme_widget_message").first();
  const bubble = messageRoot.find(".tgme_widget_message_bubble").first();
  const caption = bubble.children(".tgme_widget_message_text").first();
  const media = bubble
    .children(
      ".tgme_widget_message_grouped_wrap, .tgme_widget_message_photo_wrap, .tgme_widget_message_video_player",
    )
    .first();

  return caption.length > 0 && media.length > 0 && caption.index() < media.index();
};

const fetchTelegramPostHtml = async (
  telegramPostUrl: string,
  options: { signal?: AbortSignal } = {},
) => {
  const parsed = parseTelegramPostUrl(telegramPostUrl);
  const timeoutSignal = AbortSignal.timeout(4000);
  const signal = options.signal
    ? AbortSignal.any([options.signal, timeoutSignal])
    : timeoutSignal;
  const response = await proxyFetch(parsed.publicFeedPostUrl, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    },
    redirect: "follow",
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    throw new Error("TELEGRAM_POST_FETCH_FAILED");
  }

  return { parsed, html: await response.text() };
};

export const fetchTelegramPostSnapshot = async (
  telegramPostUrl: string,
  options: { signal?: AbortSignal } = {},
): Promise<TelegramPostSnapshot> => {
  const { html } = await fetchTelegramPostHtml(telegramPostUrl, options);
  const $ = load(html);
  const messageRoot = $(".tgme_widget_message").first();
  const scopedRoot = messageRoot.length > 0 ? messageRoot : $("body");

  return {
    plainText: scopedRoot.text().replace(/\s+/g, " ").trim(),
    ...extractTelegramInlineKeyboard(html),
    isMediaGroup: isTelegramMediaGroupPost(html),
    mediaGroupMessageIds: extractTelegramMediaGroupMessageIds(html),
    caption: extractTelegramPostCaption(html),
    showCaptionAboveMedia: isTelegramCaptionAboveMedia(html),
  };
};

export const fetchTelegramPostPreview = async (
  telegramPostUrl: string,
  options: { signal?: AbortSignal } = {},
): Promise<TelegramPostPreview> => {
  const { parsed, html } = await fetchTelegramPostHtml(
    telegramPostUrl,
    options,
  );
  const $ = load(html);

  // In embed mode, the target post might be just the first widget message
  const directPostNode = $(".tgme_widget_message").first();

  const scopedRoot = directPostNode.length > 0 ? directPostNode : $("body");

  // Try to preserve line breaks by replacing <br> with \n before taking text
  scopedRoot.find("br").replaceWith("\n");

  const descriptionCandidates = [
    scopedRoot.find(".tgme_widget_message_text").first().text(),
    scopedRoot.find(".link_preview_description").first().text(),
    $('meta[property="og:description"]').attr("content"),
    $('meta[name="description"]').attr("content"),
  ]
    .map((value) => value ? value.trim() : "") // Removing normalizeWhitespace to preserve \n
    .filter(Boolean);

  const images = new Set<string>();

  scopedRoot.find(".tgme_widget_message_photo_wrap").each((_, element) => {
    const styleUrl = extractUrlFromStyle($(element).attr("style"));
    if (styleUrl) {
      images.add(styleUrl);
    }
  });

  scopedRoot.find(".tgme_widget_message_photo img").each((_, element) => {
    const src = $(element).attr("src");
    if (src) {
      images.add(src);
    }
  });

  if (images.size === 0) {
    $('meta[property="og:image"]').each((_, element) => {
      const url = $(element).attr("content");
      if (url) {
        images.add(url);
      }
    });
  }

  return {
    telegramPostUrl: parsed.canonicalPostUrl,
    telegramChannelUrl: parsed.channelUrl,
    description:
      descriptionCandidates[0] ?? `Telegram channel post @${parsed.channelHandle}`,
    images: Array.from(images),
  };
};
