import { getTranslations } from "next-intl/server";

import { Button } from "@/shared/ui";

export default async function DealNotFound() {
  const t = await getTranslations("NotFound");

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center gap-8 px-4 py-16 text-center">
      <div className="flex flex-col items-center justify-center gap-4">
        <h1 className="text-8xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-zinc-900 to-zinc-400 dark:from-white dark:to-zinc-600 drop-shadow-sm">
          404
        </h1>
        <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
          {t("DealTitle")}
        </h2>
        <p className="max-w-[500px] text-lg text-zinc-600 dark:text-zinc-400">
          {t("DealDescription")}
        </p>
      </div>
      
      <div className="mt-2 flex flex-col items-center gap-4 sm:flex-row">
        <Button href="/deals" variant="primary" size="xl" shape="rounded-2xl">
          {t("GoDeals")}
        </Button>
      </div>
    </main>
  );
}
