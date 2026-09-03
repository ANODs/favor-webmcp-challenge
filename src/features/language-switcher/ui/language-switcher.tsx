"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { setLocaleAction } from "../api/set-locale";
import { useRouter, usePathname } from "@/i18n/routing";
import { Loader2 } from "lucide-react";

export function LanguageSwitcher() {
  const locale = useLocale() as "ru" | "en";
  const t = useTranslations("Settings");
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const handleLanguageChange = (newLocale: "ru" | "en") => {
    startTransition(async () => {
      await setLocaleAction(newLocale);
      router.replace(pathname, { locale: newLocale });
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-zinc-950">{t("Language")}</h3>
      <p className="text-sm text-zinc-500 mb-2">
        {t("LanguageDescription")}
      </p>
      
      <div className="flex items-center gap-2">
        <button
          disabled={isPending}
          onClick={() => handleLanguageChange("ru")}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-medium transition ${
            locale === "ru" 
              ? "bg-black text-white" 
              : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
          }`}
        >
          {t("RussianLanguage")}
          {isPending && locale !== "ru" && <Loader2 className="w-4 h-4 animate-spin" />}
        </button>
        <button
          disabled={isPending}
          onClick={() => handleLanguageChange("en")}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-medium transition ${
            locale === "en" 
              ? "bg-black text-white" 
              : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
          }`}
        >
          {t("EnglishLanguage")}
          {isPending && locale !== "en" && <Loader2 className="w-4 h-4 animate-spin" />}
        </button>
      </div>
    </div>
  );
}
