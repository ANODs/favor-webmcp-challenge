"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

export function VisualShowcaseCard() {
  const t = useTranslations("Index.Hero");
  return (
    <motion.div
      className="group relative overflow-hidden rounded-[2.5rem] md:col-span-2 row-span-2 shadow-md ring-1 ring-black/10 transition-shadow duration-500 hover:ring-black/20"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      <video
        src="/video/asrtonaut.webm"
        autoPlay
        loop
        muted
        playsInline
        className="theme-invert-video absolute inset-0 w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-105 opacity-80"
      />
      <div className="absolute inset-0 bento-video-overlay pointer-events-none" />
      <div className="absolute bottom-8 left-8 right-8">
        <h3 className="text-3xl font-bold text-zinc-950 tracking-tight mb-2">{t("feature2Title")}</h3>
        <p className="text-zinc-600 max-w-sm mb-4 leading-relaxed">{t("feature2Desc")}</p>
      </div>
    </motion.div>
  );
}
