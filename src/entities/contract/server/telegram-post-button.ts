import { env } from "@/shared/config/env";
import {
  buildContractStartParam,
  buildTelegramMiniAppUrl,
} from "@/shared/lib/telegram";
import {
  appendTelegramCaptionLink,
  checkTelegramChannelBotEditorAccess,
  checkTelegramChannelEditorAccess,
  editTelegramMessageCaption,
  editTelegramMessageReplyMarkup,
  fetchTelegramPostSnapshot,
  parseTelegramPostUrl,
  type TelegramPostSnapshot,
} from "@/shared/lib/telegram/server";

import type { ContractTelegramPostButtonResultDto } from "../api/dto";
import englishMessages from "./telegram-post-button.en.json";
import russianMessages from "./telegram-post-button.ru.json";

const TELEGRAM_INLINE_KEYBOARD_MAX_BUTTONS = 100;

const getTelegramPostButtonMessages = (
  titleRu?: string | null,
  titleEn?: string | null,
) => (titleEn && !titleRu ? englishMessages : russianMessages);

type SyncContractTelegramPostButtonInput = {
  slug: string;
  telegramPostUrl: string | null;
  telegramActorId: bigint;
  titleRu?: string | null;
  titleEn?: string | null;
  existingSnapshot?: TelegramPostSnapshot;
};

export async function syncContractTelegramPostButton({
  slug,
  telegramPostUrl,
  telegramActorId,
  titleRu,
  titleEn,
  existingSnapshot,
}: SyncContractTelegramPostButtonInput): Promise<ContractTelegramPostButtonResultDto> {
  if (!telegramPostUrl) {
    return { status: "skipped", reason: "contract_has_no_telegram_post" };
  }

  try {
    const parsedPost = parseTelegramPostUrl(telegramPostUrl);
    const messageId = Number(parsedPost.postId);

    if (!Number.isSafeInteger(messageId) || messageId <= 0) {
      return { status: "skipped", reason: "telegram_post_id_is_invalid" };
    }

    const channelEditorAccess = await checkTelegramChannelEditorAccess({
      chatId: `@${parsedPost.channelHandle}`,
      telegramUserId: telegramActorId,
    });

    if (!channelEditorAccess.allowed) {
      return { status: "skipped", reason: channelEditorAccess.reason };
    }

    const channelBotEditorAccess = await checkTelegramChannelBotEditorAccess({
      chatId: `@${parsedPost.channelHandle}`,
    });

    if (!channelBotEditorAccess.allowed) {
      return { status: "skipped", reason: channelBotEditorAccess.reason };
    }

    const snapshot =
      existingSnapshot ?? (await fetchTelegramPostSnapshot(telegramPostUrl));
    const contractUrl = buildTelegramMiniAppUrl(
      env.telegramBotUsername,
      buildContractStartParam(slug),
    );

    if (snapshot.isMediaGroup) {
      const linkText = getTelegramPostButtonMessages(
        titleRu,
        titleEn,
      ).captionLink;
      const captionResult = appendTelegramCaptionLink({
        caption: snapshot.caption,
        text: linkText,
        url: contractUrl,
      });

      if (captionResult.status === "unchanged") {
        return { status: "link_unchanged" };
      }

      if (captionResult.status === "too_long") {
        return { status: "skipped", reason: "telegram_caption_is_too_long" };
      }

      if (captionResult.status === "invalid_url") {
        return { status: "failed", reason: "telegram_button_is_invalid" };
      }

      const editResult = await editTelegramMessageCaption({
        chatId: `@${parsedPost.channelHandle}`,
        messageId: snapshot.mediaGroupMessageIds[0] ?? messageId,
        captionHtml: captionResult.html,
        showCaptionAboveMedia: snapshot.showCaptionAboveMedia,
      });

      return editResult.status === "updated"
        ? { status: "link_added" }
        : editResult.status === "unchanged"
          ? { status: "link_unchanged" }
          : { status: "failed", reason: editResult.reason };
    }

    if (!snapshot.isInlineKeyboardComplete) {
      return { status: "skipped", reason: "telegram_keyboard_could_not_be_preserved" };
    }

    const currentButtons = snapshot.inlineKeyboard.flat();

    if (currentButtons.some((button) => "url" in button && button.url === contractUrl)) {
      return { status: "unchanged" };
    }

    if (currentButtons.length >= TELEGRAM_INLINE_KEYBOARD_MAX_BUTTONS) {
      return { status: "skipped", reason: "telegram_keyboard_is_full" };
    }

    const buttonText = getTelegramPostButtonMessages(
      titleRu,
      titleEn,
    ).button;
    const editResult = await editTelegramMessageReplyMarkup({
      chatId: `@${parsedPost.channelHandle}`,
      messageId,
      inlineKeyboard: [
        ...snapshot.inlineKeyboard,
        [{ text: buttonText, url: contractUrl }],
      ],
    });

    return editResult.status === "updated"
      ? { status: "added" }
      : editResult.status === "unchanged"
        ? { status: "unchanged" }
        : { status: "failed", reason: editResult.reason };
  } catch (error) {
    console.error("[contract-post-button] failed to synchronize Telegram post", {
      slug,
      error,
    });
    return { status: "failed", reason: "telegram_post_sync_failed" };
  }
}
