"use client";

import { useTranslations } from "next-intl";

export function PrivacyView() {
  const t = useTranslations("Privacy");

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="space-y-8 text-zinc-300">
        <div className="space-y-4 border-b border-white/10 pb-8">
          <h1 className="text-3xl font-black text-white sm:text-4xl">{t("title")}</h1>
          <p className="text-sm text-zinc-500">{t("lastUpdated")}</p>
          <p className="text-lg text-zinc-400">{t("intro")}</p>
        </div>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-white">{t("s1_title")}</h2>
          <p className="leading-relaxed">{t("s1_content")}</p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-white">{t("s2_title")}</h2>
          <p className="leading-relaxed">{t("s2_content")}</p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-white">{t("s3_title")}</h2>
          <p className="leading-relaxed">{t("s3_content")}</p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-white">{t("s4_title")}</h2>
          <p className="leading-relaxed">{t("s4_content")}</p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-white">{t("s5_title")}</h2>
          <p className="leading-relaxed">{t("s5_content")}</p>
        </section>
      </div>
    </div>
  );
}
