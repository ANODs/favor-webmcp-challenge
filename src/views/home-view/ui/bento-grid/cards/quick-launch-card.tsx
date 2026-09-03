"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

export function QuickLaunchCard() {
  const t = useTranslations("Index.Hero");

  return (
    <motion.div
      className="group relative overflow-hidden rounded-[2.5rem] p-6 md:col-span-2 md:row-span-1 shadow-md ring-1 ring-black/10 transition-shadow duration-500 hover:ring-black/20 flex flex-col"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, ease: "easeOut", delay: 0.5 }}
    >
      <div className="absolute inset-0 bg-gradient-to-tr from-brand-blue/5 to-brand-accent/5 opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
      {/* Hyperframes Rendered Video Background */}
      <video
        src="/video/quick-launch.mp4"
        autoPlay
        loop
        muted
        playsInline
        className="theme-invert-video absolute inset-0 w-full h-full object-cover opacity-90 transition-transform duration-700 group-hover:scale-105 pointer-events-none"
      />
      
      <div className="absolute inset-0 bento-video-overlay pointer-events-none" />

      <div className="flex-1"></div>

      <div className="relative z-10 mt-8">
        <p className="text-base font-semibold text-zinc-950 tracking-tight leading-relaxed drop-shadow-md">
          {t("businessList4")}
        </p>      </div>
    </motion.div>
  );
}
