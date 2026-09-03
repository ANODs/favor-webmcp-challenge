"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  ChevronRight,
  Clapperboard,
  Link2,
  LoaderCircle,
  MessageSquareText,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import {
  getTelegramWebApp,
  openTelegramShare,
  sharePreparedTelegramMessage,
  triggerTelegramImpact,
  triggerTelegramNotification,
} from "@/shared/lib/telegram";
import {
  preparedMessageClient,
  type PreparedMessageTarget,
} from "@/shared/lib/telegram/prepared-message-client";
import { TelegramLogo } from "./telegram-logo";
import { useDialogBackButton } from "./telegram-back-button";
import { ShareIcon } from "./contract-card-icons";

type Props = {
  url: string;
  text: string;
  className?: string;
  title?: string;
  preparedMessage?: PreparedMessageTarget;
  onOpen?: () => void;
  storyShare?: {
    available: boolean;
    onShare: (onProgress: (value: number) => void) => Promise<void>;
    onError?: (error: unknown, retry: () => Promise<void>) => void;
    followUp?: {
      title: string;
      description: string;
      onShare: (onProgress: (value: number) => void) => Promise<void>;
    };
  };
  variant?: "default" | "overlay";
};

type ShareOptionProps = {
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
  active?: boolean;
};

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();

    if (!copied) {
      throw new Error("Clipboard API is unavailable");
    }
  }
}

function ShareOption({
  icon,
  title,
  description,
  onClick,
  disabled = false,
  busy = false,
  active = false,
}: ShareOptionProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-busy={busy}
      onClick={onClick}
      className={`group flex w-full items-center gap-3 rounded-2xl border bg-white p-3.5 text-left transition hover:border-zinc-300 hover:bg-zinc-50 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45 dark:bg-zinc-900 dark:hover:bg-zinc-800 ${
        active
          ? "border-brand-accent-ink ring-2 ring-brand-accent-ink/15 dark:border-brand-accent dark:ring-brand-accent/15"
          : "border-zinc-200 dark:border-white/10"
      }`}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100">
        {busy ? <LoaderCircle className="h-5 w-5 animate-spin" /> : icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-zinc-950 dark:text-white">{title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          {description}
        </span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-zinc-300 transition group-hover:translate-x-0.5 group-hover:text-zinc-500" />
    </button>
  );
}

export type TelegramShareMenuOptionId =
  | "story"
  | "story-follow-up"
  | "copy"
  | "rich"
  | "plain";

type TelegramShareMenuPanelProps = {
  storyShare?: Props["storyShare"];
  showStoryFollowUp?: boolean;
  isPreparing?: boolean;
  isPreparingStory?: boolean;
  storyProgress?: number;
  isCopied?: boolean;
  isRichShareAvailable?: boolean;
  errorMessage?: string | null;
  activeOption?: TelegramShareMenuOptionId;
  embedded?: boolean;
  onClose: () => void;
  onStoryFollowUp?: () => void;
  onStoryShare?: () => void;
  onCopyLink: () => void;
  onRichShare: () => void;
  onPlainShare: () => void;
};

export function TelegramShareMenuPanel({
  storyShare,
  showStoryFollowUp = false,
  isPreparing = false,
  isPreparingStory = false,
  storyProgress = 0,
  isCopied = false,
  isRichShareAvailable = false,
  errorMessage = null,
  activeOption,
  embedded = false,
  onClose,
  onStoryFollowUp = () => undefined,
  onStoryShare = () => undefined,
  onCopyLink,
  onRichShare,
  onPlainShare,
}: TelegramShareMenuPanelProps) {
  const t = useTranslations("ShareMenu");

  return (
    <div
      className={`w-full bg-zinc-50 px-4 pt-3 shadow-2xl dark:bg-zinc-950 ${
        embedded
          ? "h-full border-0 pb-4"
          : "rounded-t-[2rem] border-t border-black/5 pb-[calc(1rem+env(safe-area-inset-bottom))] dark:border-white/10 sm:rounded-[2rem] sm:border"
      }`}
    >
      <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-zinc-300 dark:bg-zinc-700" />

      <div className="mb-4 flex items-start justify-between gap-4 px-1">
        <div>
          <h2 className="text-base font-bold text-zinc-950 dark:text-white">{t("title")}</h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{t("subtitle")}</p>
        </div>
        <button
          type="button"
          aria-label={t("close")}
          disabled={isPreparing || isPreparingStory}
          onClick={onClose}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-zinc-600 transition hover:bg-zinc-300 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-300"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-2.5">
        {showStoryFollowUp && storyShare?.followUp ? (
          <ShareOption
            icon={<Clapperboard className="h-5 w-5" />}
            title={
              isPreparingStory
                ? t("storyGenerating", { progress: Math.round(storyProgress * 100) })
                : storyShare.followUp.title
            }
            description={storyShare.followUp.description}
            onClick={onStoryFollowUp}
            disabled={isPreparing || isPreparingStory}
            busy={isPreparingStory}
            active={activeOption === "story-follow-up"}
          />
        ) : null}
        {storyShare ? (
          <ShareOption
            icon={<Clapperboard className="h-5 w-5" />}
            title={
              isPreparingStory
                ? t("storyGenerating", { progress: Math.round(storyProgress * 100) })
                : t("telegramStory")
            }
            description={
              storyShare.available
                ? t("telegramStoryDescription")
                : t("storyUnavailable")
            }
            onClick={onStoryShare}
            disabled={!storyShare.available || isPreparing || isPreparingStory}
            busy={isPreparingStory}
            active={activeOption === "story"}
          />
        ) : null}
        <ShareOption
          icon={
            isCopied ? (
              <Check className="h-5 w-5 text-emerald-600" />
            ) : (
              <Link2 className="h-5 w-5" />
            )
          }
          title={isCopied ? t("linkCopied") : t("copyLink")}
          description={t("copyLinkDescription")}
          onClick={onCopyLink}
          disabled={isPreparing || isPreparingStory}
          active={activeOption === "copy"}
        />
        <ShareOption
          icon={
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#229ED9] text-white">
              <TelegramLogo size={18} />
            </span>
          }
          title={isPreparing ? t("preparing") : t("richTelegram")}
          description={
            isRichShareAvailable ? t("richTelegramDescription") : t("richUnavailable")
          }
          onClick={onRichShare}
          disabled={!isRichShareAvailable || isPreparing || isPreparingStory}
          busy={isPreparing}
          active={activeOption === "rich"}
        />
        <ShareOption
          icon={<MessageSquareText className="h-5 w-5" />}
          title={t("plainTelegram")}
          description={t("plainTelegramDescription")}
          onClick={onPlainShare}
          disabled={isPreparing || isPreparingStory}
          active={activeOption === "plain"}
        />
      </div>

      {errorMessage ? (
        <p className="mt-3 rounded-2xl bg-red-50 px-3 py-2.5 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}

export function TelegramShareIconButton({
  url,
  text,
  className = "",
  title,
  preparedMessage,
  onOpen,
  storyShare,
  variant = "default",
}: Props) {
  const t = useTranslations("ShareMenu");
  const [isOpen, setIsOpen] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isPreparingStory, setIsPreparingStory] = useState(false);
  const [storyProgress, setStoryProgress] = useState(0);
  const [showStoryFollowUp, setShowStoryFollowUp] = useState(false);
  const [isRichShareAvailable, setIsRichShareAvailable] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const closeMenu = useCallback(() => {
    if (isPreparing || isPreparingStory) {
      return;
    }

    setIsOpen(false);
    setErrorMessage(null);
  }, [isPreparing, isPreparingStory]);

  useDialogBackButton(isOpen, closeMenu);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeMenu, isOpen]);

  const handleOpenMenu = () => {
    triggerTelegramImpact("light");
    onOpen?.();
    const webApp = getTelegramWebApp();

    setIsRichShareAvailable(
      Boolean(preparedMessage && webApp?.initData && webApp.shareMessage),
    );
    setIsCopied(false);
    setShowStoryFollowUp(false);
    setErrorMessage(null);
    setIsOpen(true);
  };

  const handleCopyLink = async () => {
    triggerTelegramImpact("light");
    setErrorMessage(null);

    try {
      await copyText(url);
      setIsCopied(true);
      triggerTelegramNotification("success");
    } catch (error) {
      console.warn("[telegram-share] failed to copy link", error);
      setErrorMessage(t("copyError"));
      triggerTelegramNotification("error");
    }
  };

  const handleRichShare = async () => {
    if (isPreparing || !preparedMessage) {
      return;
    }

    const webApp = getTelegramWebApp();

    if (!webApp?.initData || !webApp.shareMessage) {
      setIsRichShareAvailable(false);
      setErrorMessage(t("richUnavailable"));
      return;
    }

    triggerTelegramImpact("medium");
    setErrorMessage(null);
    setIsPreparing(true);

    try {
      const locale = document.documentElement.lang === "en" ? "en" : "ru";
      const prepared = await preparedMessageClient.createMessage(preparedMessage, locale);

      if (!sharePreparedTelegramMessage(prepared.id)) {
        throw new Error("Telegram shareMessage is unavailable");
      }

      setIsOpen(false);
    } catch (error) {
      console.warn("[telegram-share] prepared message unavailable", error);
      setErrorMessage(t("richError"));
      triggerTelegramNotification("error");
    } finally {
      setIsPreparing(false);
    }
  };

  const handlePlainShare = () => {
    triggerTelegramImpact("light");
    setIsOpen(false);
    openTelegramShare(url, text);
  };

  const handleStoryShare = async () => {
    if (!storyShare?.available || isPreparing || isPreparingStory) return;

    triggerTelegramImpact("medium");
    setErrorMessage(null);
    setStoryProgress(0);
    setIsPreparingStory(true);
    try {
      await storyShare.onShare(setStoryProgress);
      setShowStoryFollowUp(Boolean(storyShare.followUp));
    } catch (error) {
      console.warn("[telegram-share] story export failed", error);
      if (storyShare.onError) {
        storyShare.onError(error, async () => {
          setErrorMessage(null);
          setStoryProgress(0);
          setIsPreparingStory(true);
          try {
            await storyShare.onShare(setStoryProgress);
            setShowStoryFollowUp(Boolean(storyShare.followUp));
          } finally {
            setIsPreparingStory(false);
          }
        });
      } else {
        setErrorMessage(t("storyError"));
        triggerTelegramNotification("error");
      }
    } finally {
      setIsPreparingStory(false);
    }
  };

  const handleStoryFollowUp = async () => {
    if (!storyShare?.followUp || isPreparing || isPreparingStory) return;

    triggerTelegramImpact("medium");
    setErrorMessage(null);
    setStoryProgress(0);
    setIsPreparingStory(true);
    try {
      await storyShare.followUp.onShare(setStoryProgress);
      setShowStoryFollowUp(false);
    } catch (error) {
      console.warn("[telegram-share] follow-up story export failed", error);
      if (storyShare.onError) {
        storyShare.onError(error, async () => {
          setErrorMessage(null);
          setStoryProgress(0);
          setIsPreparingStory(true);
          try {
            await storyShare.followUp!.onShare(setStoryProgress);
            setShowStoryFollowUp(false);
          } finally {
            setIsPreparingStory(false);
          }
        });
      } else {
        setErrorMessage(t("storyError"));
        triggerTelegramNotification("error");
      }
    } finally {
      setIsPreparingStory(false);
    }
  };

  const portalRoot = typeof document === "undefined" ? null : document.body;
  const shareMenu = portalRoot
    ? createPortal(
        <AnimatePresence>
          {isOpen ? (
            <motion.div
              className="fixed inset-0 z-[70] flex items-end justify-center sm:p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.button
                type="button"
                aria-label={t("close")}
                className="absolute inset-0 bg-black/65 backdrop-blur-[2px]"
                onClick={closeMenu}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-label={t("title")}
                className="relative z-10 w-full sm:max-w-md"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 28, stiffness: 300 }}
                onClick={(event) => event.stopPropagation()}
              >
                <TelegramShareMenuPanel
                  storyShare={storyShare}
                  showStoryFollowUp={showStoryFollowUp}
                  isPreparing={isPreparing}
                  isPreparingStory={isPreparingStory}
                  storyProgress={storyProgress}
                  isCopied={isCopied}
                  isRichShareAvailable={isRichShareAvailable}
                  errorMessage={errorMessage}
                  onClose={closeMenu}
                  onStoryFollowUp={() => void handleStoryFollowUp()}
                  onStoryShare={() => void handleStoryShare()}
                  onCopyLink={() => void handleCopyLink()}
                  onRichShare={() => void handleRichShare()}
                  onPlainShare={handlePlainShare}
                />
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>,
        portalRoot,
      )
    : null;

  return (
    <>
      <button
        type="button"
        aria-label={title ?? t("buttonLabel")}
        title={title ?? t("buttonLabel")}
        onClick={handleOpenMenu}
        className={`inline-flex items-center justify-center rounded-full border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 ${
          variant === "overlay"
            ? "h-11 w-11 border-white/20 bg-black/55 text-white shadow-lg backdrop-blur-md hover:bg-black/75"
            : "h-9 w-9 border-zinc-200 bg-transparent text-zinc-700 hover:border-zinc-300 hover:text-zinc-950 dark:border-white/10 dark:text-zinc-200 dark:hover:border-white/20 dark:hover:text-white"
        } ${className}`}
      >
        <ShareIcon className={variant === "overlay" ? "h-5 w-5" : "h-4 w-4"} />
      </button>
      {shareMenu}
    </>
  );
}
