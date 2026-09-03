import * as cheerio from "cheerio";

import {
  classifyChannelDescriptionContacts,
  extractScoutingContacts,
  normalizeChannelHandle,
} from "./helpers";
import type {
  ParsedTelegramChannelPage,
  ParsedTelegramPost,
  TelegramLink,
} from "./types";

const normalizeExtractedText = (value: string) =>
  value
    .replace(/\u00a0/g, " ")
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const normalizeLinkUrl = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed || /^(?:javascript|data):/i.test(trimmed)) return null;
  if (/^(?:tg|mailto|tel):/i.test(trimmed)) return trimmed;

  try {
    const url = new URL(trimmed, "https://t.me/");
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
};

const dedupeLinks = (links: TelegramLink[]) => {
  const unique = new Map<string, TelegramLink>();
  for (const link of links) {
    const key = `${link.text}\u0000${link.url}`;
    if (!unique.has(key)) unique.set(key, link);
  }
  return [...unique.values()];
};

export const parseTelegramChannelPage = (
  html: string,
  fallbackHandle: string,
): ParsedTelegramChannelPage => {
  const $ = cheerio.load(html);
  const fallback = normalizeChannelHandle(fallbackHandle);

  const readText = (selector: string) => {
    const element = $(selector).first().clone();
    element.find("br").replaceWith("\n");
    return normalizeExtractedText(element.text());
  };

  const pageHandleSource =
    $("meta[property='og:url']").attr("content") ??
    $("link[rel='canonical']").attr("href") ??
    fallback;
  let pageHandle = fallback;
  try {
    pageHandle = normalizeChannelHandle(pageHandleSource);
  } catch {
    pageHandle = fallback;
  }

  const description = readText(".tgme_channel_info_description") || null;
  const descriptionLinks: TelegramLink[] = [];
  $(".tgme_channel_info_description a[href]").each((_, element) => {
    const link = $(element);
    const url = normalizeLinkUrl(link.attr("href") ?? "");
    if (!url) return;
    descriptionLinks.push({ text: normalizeExtractedText(link.text()), url });
  });
  const posts: ParsedTelegramPost[] = [];

  $(".tgme_widget_message[data-post]").each((_, element) => {
    const message = $(element);
    const dataPost = message.attr("data-post")?.trim() ?? "";
    const match = dataPost.match(/^([A-Za-z][A-Za-z0-9_]{4,31})\/(\d+)$/);
    if (!match) return;

    const channelHandle = normalizeChannelHandle(match[1]);
    const postId = Number(match[2]);
    if (!Number.isSafeInteger(postId) || postId <= 0) return;

    const datetime = message
      .find(".tgme_widget_message_date time[datetime]")
      .first()
      .attr("datetime");
    if (!datetime || !Number.isFinite(Date.parse(datetime))) return;

    const textElement = message.find(".tgme_widget_message_text").first().clone();
    textElement.find("br").replaceWith("\n");
    const rawText = normalizeExtractedText(textElement.text());

    const readLinks = (selector: string): TelegramLink[] => {
      const links: TelegramLink[] = [];
      message.find(selector).each((__, linkElement) => {
        const link = $(linkElement);
        const url = normalizeLinkUrl(link.attr("href") ?? "");
        if (!url) return;
        links.push({
          text: normalizeExtractedText(link.text()),
          url,
        });
      });
      return dedupeLinks(links);
    };

    const inlineLinks = readLinks(".tgme_widget_message_text a[href]");
    const buttons = readLinks(".tgme_widget_message_inline_button[href]");
    const base = {
      channelHandle,
      channelUrl: `https://t.me/${channelHandle}`,
      postId,
      postUrl: `https://t.me/${channelHandle}/${postId}`,
      publishedAt: new Date(datetime).toISOString(),
      rawText,
      inlineLinks,
      buttons,
    };

    posts.push({
      ...base,
      contacts: extractScoutingContacts({ text: rawText, inlineLinks, buttons }),
    });
  });

  const uniquePosts = new Map<string, ParsedTelegramPost>();
  for (const post of posts) uniquePosts.set(post.postUrl, post);

  return {
    metadata: {
      handle: pageHandle,
      url: `https://t.me/${pageHandle}`,
      title: readText(".tgme_channel_info_header_title") || null,
      description,
      subscriberText:
        readText(".tgme_channel_info_counter .counter_value") ||
        readText(".tgme_channel_info_counter") ||
        null,
      descriptionContacts: description
        ? classifyChannelDescriptionContacts(description, dedupeLinks(descriptionLinks))
        : [],
    },
    posts: [...uniquePosts.values()],
  };
};
