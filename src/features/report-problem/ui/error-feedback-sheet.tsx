"use client";

import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Copy,
  Headphones,
  RefreshCw,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { triggerTelegramNotification } from "@/shared/lib/telegram";
import { BottomSheet, Button } from "@/shared/ui";

import { copyDiagnosticSnapshot } from "../lib/copy-diagnostic";
import { openDiagnosticSupport } from "../lib/open-diagnostic-support";
import type { ActiveErrorFeedback } from "../model/types";

type Props = {
  active: ActiveErrorFeedback | null;
  isRetrying: boolean;
  onClose: () => void;
  onRetry: () => Promise<void>;
};

export function ErrorFeedbackSheet({ active, isRetrying, onClose, onRetry }: Props) {
  const t = useTranslations("ErrorFeedback");
  const [showDetails, setShowDetails] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isOpeningSupport, setIsOpeningSupport] = useState(false);
  const [supportFallback, setSupportFallback] = useState(false);

  if (!active) return null;

  const handleCopy = async () => {
    try {
      await copyDiagnosticSnapshot(active.snapshot);
      setIsCopied(true);
      triggerTelegramNotification("success");
    } catch {
      triggerTelegramNotification("error");
    }
  };

  const handleSupport = async () => {
    if (isOpeningSupport) return;
    setIsOpeningSupport(true);
    setSupportFallback(false);

    try {
      const result = await openDiagnosticSupport(active.snapshot);
      setSupportFallback(result === "clipboard-fallback");
    } finally {
      setIsOpeningSupport(false);
    }
  };

  const recentActions = active.snapshot.breadcrumbs.slice(-8);

  return (
    <BottomSheet
      isOpen
      onClose={onClose}
      ariaLabel={active.options.title}
      closeLabel={t("close")}
      rootClassName="z-[90]"
    >
      <div className="px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3 sm:px-6 sm:pb-6">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <h2 className="text-lg font-bold text-zinc-950 dark:text-white">
              {active.options.title}
            </h2>
            <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              {active.options.description ?? t("description")}
            </p>
          </div>
          <button
            type="button"
            aria-label={t("close")}
            onClick={onClose}
            disabled={isRetrying || isOpeningSupport}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-3.5 py-3 dark:border-white/10 dark:bg-zinc-900">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
              {t("errorCode")}
            </p>
            <p className="mt-0.5 font-mono text-sm font-semibold text-zinc-950 dark:text-white">
              {active.snapshot.code} · {active.snapshot.fingerprint}
            </p>
          </div>
          {active.occurrences > 1 ? (
            <span className="rounded-full bg-zinc-200 px-2.5 py-1 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              ×{active.occurrences}
            </span>
          ) : null}
        </div>

        <div className="mt-4 grid gap-2.5">
          {active.options.retry ? (
            <Button
              type="button"
              fullWidth
              size="lg"
              loading={isRetrying}
              disabled={isOpeningSupport}
              onClick={() => void onRetry()}
            >
              <RefreshCw className="h-4 w-4" />
              {isRetrying ? t("retrying") : t("retry")}
            </Button>
          ) : null}
          <Button
            type="button"
            fullWidth
            size="lg"
            variant={active.options.retry ? "secondary" : "primary"}
            loading={isOpeningSupport}
            disabled={isRetrying}
            onClick={() => void handleSupport()}
          >
            <Headphones className="h-4 w-4" />
            {t("support")}
          </Button>
          <Button
            type="button"
            fullWidth
            size="md"
            variant="ghost"
            disabled={isRetrying || isOpeningSupport}
            onClick={() => void handleCopy()}
          >
            <Copy className="h-4 w-4" />
            {isCopied ? t("copied") : t("copy")}
          </Button>
        </div>

        {supportFallback ? (
          <p className="mt-3 rounded-2xl bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            {t("supportFallback")}
          </p>
        ) : null}

        <button
          type="button"
          aria-expanded={showDetails}
          onClick={() => setShowDetails((value) => !value)}
          className="mt-4 flex w-full items-center justify-between rounded-2xl px-1 py-2 text-left text-sm font-semibold text-zinc-700 dark:text-zinc-300"
        >
          <span>{t("technicalDetails")}</span>
          {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {showDetails ? (
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3.5 text-xs leading-5 text-zinc-600 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-400">
            <p><span className="font-semibold text-zinc-900 dark:text-zinc-100">{t("message")}:</span> {active.snapshot.message}</p>
            <p><span className="font-semibold text-zinc-900 dark:text-zinc-100">{t("route")}:</span> {active.snapshot.route ?? "—"}</p>
            <p className="mt-3 font-semibold text-zinc-900 dark:text-zinc-100">{t("recentActions")}</p>
            <ol className="mt-1 space-y-1 font-mono text-[11px]">
              {recentActions.length ? recentActions.map((item) => (
                <li key={`${item.timestamp}-${item.name}`}>
                  {item.category}/{item.name} · {item.outcome ?? "info"}
                </li>
              )) : <li>{t("noActions")}</li>}
            </ol>
            <p className="mt-3 text-[11px] leading-4 text-zinc-500">{t("privacy")}</p>
          </div>
        ) : null}
      </div>
    </BottomSheet>
  );
}
