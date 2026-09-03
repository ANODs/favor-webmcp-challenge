"use client";

import { useEffect, useMemo, useState } from "react";
import { createDiagnosticSnapshot } from "@/shared/lib/client-diagnostics";
import { openDiagnosticSupport } from "@/features/report-problem";
import { useRootFallbackCopy } from "@/shared/lib/root-fallback";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { copy, locale } = useRootFallbackCopy();
  const [openingSupport, setOpeningSupport] = useState(false);
  const diagnostic = useMemo(
    () =>
      createDiagnosticSnapshot(error, {
        code: error.digest ? "NEXT_GLOBAL_SERVER_ERROR" : "NEXT_GLOBAL_CLIENT_ERROR",
        area: "global-boundary",
        metadata: { digest: error.digest ?? null },
      }),
    [error],
  );

  useEffect(() => {
    console.error("Critical Global Error:", error);
  }, [error]);

  return (
    <html lang={locale} className="dark">
      <body className="bg-zinc-950 font-sans text-white">
        <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col items-center justify-center gap-8 px-4 py-10 sm:py-14 text-center">
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="rounded-full bg-red-100 p-5 dark:bg-red-900/20 mb-2 shadow-sm">
              <svg className="h-10 w-10 text-red-600 dark:text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {copy.globalError.title}
            </h1>
            <p className="max-w-[500px] text-lg text-zinc-400">
              {copy.globalError.description}
            </p>
          </div>
          
          <div className="mt-4 flex flex-col items-center gap-3 sm:flex-row">
            <button
              onClick={() => reset()}
              className="inline-flex h-12 items-center justify-center rounded-2xl bg-white px-8 text-base font-medium text-zinc-950 transition-colors hover:bg-zinc-200"
            >
              {copy.globalError.retry}
            </button>
            <button
              onClick={() => window.location.href = "/"}
              className="inline-flex h-12 items-center justify-center rounded-2xl bg-zinc-800 px-8 text-base font-medium text-white transition-colors hover:bg-zinc-700"
            >
              {copy.globalError.home}
            </button>
            <button
              onClick={() => {
                setOpeningSupport(true);
                void openDiagnosticSupport(diagnostic).finally(() => setOpeningSupport(false));
              }}
              disabled={openingSupport}
              className="inline-flex h-12 items-center justify-center rounded-2xl bg-zinc-800 px-8 text-base font-medium text-white transition-colors hover:bg-zinc-700"
            >
              {openingSupport
                ? copy.globalError.openingSupport
                : copy.globalError.support}
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
