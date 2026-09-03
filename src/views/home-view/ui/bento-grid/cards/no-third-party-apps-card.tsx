"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Telegram3DScene } from "./telegram-3d-scene";

export function NoThirdPartyAppsCard() {
  const t = useTranslations("Index.Hero");
  return (
    <motion.div
      className="group relative overflow-hidden rounded-[2.5rem] p-6 md:col-span-1 row-span-2 shadow-md ring-1 ring-black/10 transition-shadow duration-500 hover:ring-black/20 flex flex-col"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-brand-blue/10 to-transparent opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="relative flex-1 flex items-center justify-center w-full min-h-[160px]">
        <div className="absolute inset-0 bg-brand-blue/20 blur-3xl rounded-full mix-blend-screen group-hover:bg-brand-blue/30 transition-colors duration-500" />
        <Telegram3DScene />
      </div>
      <div className="relative z-10 mt-6 text-center">
        <h3 className="text-xl font-bold text-zinc-950 mb-3 tracking-tight">{t("feature1Title")}</h3>
        <p className="text-sm text-zinc-600 leading-relaxed font-medium">{t("feature1Desc")}</p>
      </div>
    </motion.div>
  );
}
