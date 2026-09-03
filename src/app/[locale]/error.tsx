"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/shared/ui";
import { createDiagnosticSnapshot } from "@/shared/lib/client-diagnostics";
import {
  copyDiagnosticSnapshot,
  openDiagnosticSupport,
} from "@/features/report-problem";
import { useTranslations } from "next-intl";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("GlobalError");
  const [copied, setCopied] = useState(false);
  const [openingSupport, setOpeningSupport] = useState(false);
  const diagnostic = useMemo(
    () =>
      createDiagnosticSnapshot(error, {
        code: error.digest ? "NEXT_SERVER_BOUNDARY_ERROR" : "NEXT_CLIENT_BOUNDARY_ERROR",
        area: "route-boundary",
        metadata: { digest: error.digest ?? null },
      }),
    [error],
  );

  useEffect(() => {
    console.error("Global Error boundary caught:", error);
  }, [error]);

  const handleCopy = () => {
    copyDiagnosticSnapshot(diagnostic).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleSupport = async () => {
    setOpeningSupport(true);
    try {
      await openDiagnosticSupport(diagnostic);
    } finally {
      setOpeningSupport(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col items-center justify-center gap-8 px-4 py-10 sm:py-14 text-center">
      <div className="flex flex-col items-center justify-center gap-4">
        <div className="rounded-full bg-red-100 p-5 dark:bg-red-900/20 mb-2 shadow-sm">
          <svg className="h-10 w-10 text-red-600 dark:text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
          {t("title")}
        </h1>
        <p className="max-w-[500px] text-lg text-zinc-600 dark:text-zinc-400">
          {t("description")}
        </p>
      </div>
      
      <div className="mt-4 flex flex-col items-center gap-3 sm:flex-row">
        <Button onClick={() => reset()} variant="primary" size="xl" shape="rounded-2xl">
          {t("retry")}
        </Button>
        <Button onClick={() => window.location.href = "/"} variant="secondary" size="xl" shape="rounded-2xl">
          {t("go_home")}
        </Button>
        <Button
          onClick={() => void handleSupport()}
          loading={openingSupport}
          variant="secondary"
          size="xl"
          shape="rounded-2xl"
        >
          {t("report_problem")}
        </Button>
      </div>

      <div className="mt-4">
        <Button onClick={() => void handleCopy()} variant="secondary" size="md" shape="rounded-2xl" className="text-sm">
          {copied ? t("error_copied") : t("copy_error")}
        </Button>
      </div>
    </main>
  );
}
