"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  createDiagnosticSnapshot,
  recordDiagnosticBreadcrumb,
  registerRecoverableErrorReporter,
} from "@/shared/lib/client-diagnostics";
import { triggerTelegramNotification } from "@/shared/lib/telegram";

import { ErrorFeedbackSheet } from "../ui/error-feedback-sheet";
import type {
  ActiveErrorFeedback,
  ErrorFeedbackContextValue,
  ErrorFeedbackOptions,
} from "./types";

const ErrorFeedbackContext = createContext<ErrorFeedbackContextValue | null>(null);

export function ErrorFeedbackProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const t = useTranslations("ErrorFeedback");
  const [active, setActive] = useState<ActiveErrorFeedback | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    recordDiagnosticBreadcrumb({
      category: "navigation",
      name: pathname,
      outcome: "info",
    });
  }, [pathname]);

  const reportError = useCallback((error: unknown, options: ErrorFeedbackOptions) => {
    const snapshot = createDiagnosticSnapshot(error, options);
    recordDiagnosticBreadcrumb({
      category: "system",
      name: options.area,
      outcome: "failure",
      metadata: { code: snapshot.code, fingerprint: snapshot.fingerprint },
    });
    triggerTelegramNotification("error");

    setActive((current) =>
      current?.snapshot.fingerprint === snapshot.fingerprint
        ? { ...current, snapshot, occurrences: current.occurrences + 1 }
        : { snapshot, options, occurrences: 1 },
    );
    return snapshot.id;
  }, []);

  const dismissError = useCallback(() => {
    if (!isRetrying) setActive(null);
  }, [isRetrying]);

  useEffect(
    () => registerRecoverableErrorReporter(reportError),
    [reportError],
  );

  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      reportError(event.reason, {
        code: "UNHANDLED_PROMISE_REJECTION",
        area: "app",
        title: t("unexpectedTitle"),
        description: t("unexpectedDescription"),
      });
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    return () => window.removeEventListener("unhandledrejection", handleUnhandledRejection);
  }, [reportError, t]);

  const retry = useCallback(async () => {
    if (!active?.options.retry || isRetrying) return;

    setIsRetrying(true);
    recordDiagnosticBreadcrumb({
      category: "action",
      name: `${active.options.area}.retry`,
      outcome: "started",
    });

    try {
      await active.options.retry();
      recordDiagnosticBreadcrumb({
        category: "action",
        name: `${active.options.area}.retry`,
        outcome: "success",
      });
      setActive(null);
    } catch (error) {
      const snapshot = createDiagnosticSnapshot(error, active.options);
      recordDiagnosticBreadcrumb({
        category: "action",
        name: `${active.options.area}.retry`,
        outcome: "failure",
        metadata: { code: snapshot.code },
      });
      setActive((current) =>
        current
          ? { ...current, snapshot, occurrences: current.occurrences + 1 }
          : { snapshot, options: active.options, occurrences: 1 },
      );
      triggerTelegramNotification("error");
    } finally {
      setIsRetrying(false);
    }
  }, [active, isRetrying]);

  const value = useMemo(
    () => ({ reportError, dismissError }),
    [dismissError, reportError],
  );

  return (
    <ErrorFeedbackContext.Provider value={value}>
      {children}
      <ErrorFeedbackSheet
        key={active?.snapshot.id ?? "closed"}
        active={active}
        isRetrying={isRetrying}
        onClose={dismissError}
        onRetry={retry}
      />
    </ErrorFeedbackContext.Provider>
  );
}

export function useErrorFeedback() {
  const context = useContext(ErrorFeedbackContext);
  if (!context) {
    throw new Error("useErrorFeedback must be used inside ErrorFeedbackProvider");
  }
  return context;
}
