"use client";

import { Button } from "@/shared/ui";
import { useRootFallbackCopy } from "@/shared/lib/root-fallback";

export default function RootNotFound() {
  const { copy, locale } = useRootFallbackCopy();

  return (
    <html lang={locale} className="h-full antialiased font-sans">
      <body className="min-h-full bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
        <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col items-center justify-center gap-8 px-4 py-10 sm:py-14 text-center">
          <div className="flex flex-col items-center justify-center gap-4">
            <h1 className="text-9xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-zinc-900 to-zinc-400 dark:from-white dark:to-zinc-600 drop-shadow-sm">
              404
            </h1>
            <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
              {copy.notFound.title}
            </h2>
            <p className="max-w-[500px] text-lg text-zinc-600 dark:text-zinc-400">
              {copy.notFound.description}
            </p>
          </div>
          
          <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row">
            <Button
              onClick={() => {
                window.location.href = `/${locale}`;
              }}
              variant="primary"
              size="xl"
              shape="rounded-2xl"
            >
              {copy.notFound.home}
            </Button>
          </div>
        </main>
      </body>
    </html>
  );
}
