"use client";

import { useMutation } from "@tanstack/react-query";
import { Bot, CheckCircle2, ExternalLink, Link2, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  buildTelegramChannelBotAdminUrl,
  openTelegramLink,
  triggerTelegramNotification,
} from "@/shared/lib/telegram";
import { Button } from "@/shared/ui";

import { contractsClient } from "../api/contracts-client";
import type { ContractTelegramPostButtonReasonDto } from "../api/dto";

type CreateProps = {
  variant: "create";
  botUsername: string;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
};

type EditProps = {
  variant: "edit";
  botUsername: string;
  slug: string;
  isPostLinkSaved: boolean;
};

type Props = (CreateProps | EditProps) & {
  className?: string;
  compact?: boolean;
};

const getFailureMessageKey = (reason: ContractTelegramPostButtonReasonDto) => {
  switch (reason) {
    case "contract_has_no_telegram_post":
      return "ErrorNoPost" as const;
    case "telegram_post_id_is_invalid":
      return "ErrorInvalidPost" as const;
    case "telegram_keyboard_could_not_be_preserved":
      return "ErrorKeyboard" as const;
    case "telegram_keyboard_is_full":
      return "ErrorKeyboardFull" as const;
    case "telegram_channel_access_could_not_be_verified":
      return "ErrorAccessCheck" as const;
    case "telegram_user_cannot_edit_channel":
      return "ErrorUserRights" as const;
    case "telegram_bot_access_could_not_be_verified":
      return "ErrorBotAccessCheck" as const;
    case "telegram_bot_cannot_edit_channel":
      return "ErrorBotRights" as const;
    case "telegram_post_cannot_be_edited":
      return "ErrorPostEdit" as const;
    case "telegram_button_is_invalid":
      return "ErrorButton" as const;
    case "telegram_caption_is_invalid":
      return "ErrorCaption" as const;
    case "telegram_caption_is_too_long":
      return "ErrorCaptionTooLong" as const;
    case "telegram_api_rejected_post_edit":
      return "ErrorTelegram" as const;
    case "telegram_post_sync_failed":
      return "ErrorUnknown" as const;
  }
};

const isSuccessfulResult = (status?: string) =>
  status === "added" ||
  status === "unchanged" ||
  status === "link_added" ||
  status === "link_unchanged";

export function TelegramPostButtonControl(props: Props) {
  const t = useTranslations("ContractTelegramPostButton");
  const syncMutation = useMutation({
    mutationFn: () => {
      if (props.variant !== "edit") {
        throw new Error(t("ErrorUnknown"));
      }

      return contractsClient.syncTelegramPostButton(props.slug);
    },
    onSuccess: (result) => {
      triggerTelegramNotification(
        isSuccessfulResult(result.status) ? "success" : "error",
      );
    },
    onError: () => triggerTelegramNotification("error"),
  });

  const result = syncMutation.data;
  const resultMessage = result
    ? result.status === "added"
      ? t("Added")
      : result.status === "unchanged"
        ? t("Unchanged")
        : result.status === "link_added"
          ? t("LinkAdded")
          : result.status === "link_unchanged"
            ? t("LinkUnchanged")
        : "reason" in result
          ? t(getFailureMessageKey(result.reason))
          : t("ErrorUnknown")
    : syncMutation.isError
      ? t("ErrorUnknown")
      : null;
  const isSuccess = isSuccessfulResult(result?.status);

  return (
    <section
      className={`border-t border-zinc-200 pt-6 dark:border-white/10 ${props.className ?? ""}`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border ${
            props.variant === "create"
              ? "border-brand-accent-ink/20 bg-brand-accent/10 text-brand-accent-ink dark:border-brand-accent/20 dark:text-brand-accent"
              : "border-zinc-200 bg-white text-zinc-600 dark:border-white/10"
          }`}
        >
          <Bot className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-zinc-950">{t("Title")}</h3>
          <p className="mt-1 text-sm leading-6 text-zinc-600">
            {t("Description")}
          </p>
        </div>
      </div>

      <div className={`mt-4 grid gap-3 ${props.compact ? "" : "sm:grid-cols-2"}`}>
        <Button
          type="button"
          variant="secondary"
          shape="rounded-2xl"
          size="lg"
          fullWidth
          onClick={() =>
            openTelegramLink(
              buildTelegramChannelBotAdminUrl(props.botUsername),
            )
          }
        >
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
          {t("AddBot")}
        </Button>

        {props.variant === "create" ? (
          <label
            className={`flex min-h-12 cursor-pointer items-center justify-center gap-3 rounded-2xl border px-5 py-3.5 text-center text-sm font-semibold transition ${
              props.enabled
                ? "border-brand-accent-ink/40 bg-brand-accent/10 text-brand-accent-ink dark:border-brand-accent/40 dark:text-brand-accent"
                : "border-zinc-200 bg-transparent text-zinc-900 hover:bg-zinc-50 dark:border-white/10 dark:hover:bg-white/5"
            }`}
          >
            <input
              type="checkbox"
              checked={props.enabled}
              onChange={(event) => props.onEnabledChange(event.target.checked)}
              className="h-4 w-4 shrink-0 rounded border-zinc-300 accent-brand-accent-ink dark:accent-brand-accent"
            />
            <Link2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            {t("AddAfterCreate")}
          </label>
        ) : (
          <Button
            type="button"
            shape="rounded-2xl"
            size="lg"
            fullWidth
            loading={syncMutation.isPending}
            disabled={!props.isPostLinkSaved || syncMutation.isPending}
            onClick={() => syncMutation.mutate()}
          >
            <Link2 className="h-4 w-4" aria-hidden="true" />
            {syncMutation.isPending ? t("Adding") : t("AddNow")}
          </Button>
        )}
      </div>

      <p className="mt-3 text-xs leading-5 text-zinc-500">
        {props.variant === "create"
          ? t("CreateHelper")
          : props.isPostLinkSaved
            ? t("EditHelper")
            : t("SavePostFirst")}
      </p>

      {resultMessage ? (
        <div
          className={`mt-3 flex items-start gap-2 rounded-2xl border p-3 text-sm leading-5 ${
            isSuccess
              ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200"
              : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200"
          }`}
          role={isSuccess ? "status" : "alert"}
        >
          {isSuccess ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          <span>{resultMessage}</span>
        </div>
      ) : null}
    </section>
  );
}
