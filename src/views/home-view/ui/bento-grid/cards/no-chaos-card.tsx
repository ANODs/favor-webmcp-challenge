"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

export function NoChaosCard() {
  const t = useTranslations("Index.Hero");

  return (
    <motion.div
      className="group relative overflow-hidden rounded-[2.5rem] p-6 md:col-span-1 row-span-2 shadow-md ring-1 ring-black/10 transition-shadow duration-500 hover:ring-black/20 flex flex-col"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, ease: "easeOut", delay: 0.4 }}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-brand-pink/10 to-transparent opacity-50 transition-opacity duration-500" />
      <div className="relative flex-1 flex flex-col items-center justify-center w-full">
        <div className="absolute inset-0 bg-brand-pink/10 blur-3xl rounded-full mix-blend-screen group-hover:bg-brand-pink/20 transition-colors duration-500" />

        {/* Infinite Chat Spam Animation */}
        <div
          className="relative w-full h-48 md:h-96 max-w-[180px] overflow-hidden"
          style={{ WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 20%, black 80%, transparent)', maskImage: 'linear-gradient(to bottom, transparent, black 20%, black 80%, transparent)' }}
        >
          <motion.div
            className="flex flex-col gap-3 absolute w-full"
            animate={{ y: ["0%", "-50%"] }}
            transition={{
              repeat: Infinity,
              ease: "linear",
              duration: 4,
            }}
          >
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex flex-col gap-3 w-full">
                {/* Left Bubble */}
                <div className="flex w-full">
                  <div className="bg-white/10 backdrop-blur-md rounded-2xl rounded-bl-sm p-3 w-[85%] ring-1 ring-black/5 shadow-lg relative">
                    <div className="h-1.5 w-1/2 bg-white/30 rounded-full mb-1.5" />
                    <div className="h-1.5 w-full bg-white/20 rounded-full" />
                  </div>
                </div>
                {/* Right Bubble */}
                <div className="flex w-full justify-end">
                  <div className="bg-brand-pink/20 backdrop-blur-md rounded-2xl rounded-br-sm p-3 w-[85%] ring-1 ring-brand-pink/30 shadow-lg relative">
                    <div className="h-1.5 w-full bg-brand-pink/40 rounded-full mb-1.5" />
                    <div className="h-1.5 w-2/3 bg-brand-pink/20 rounded-full ml-auto" />
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      <div className="relative z-10 mt-6 text-center">
        <h3 className="text-xl font-bold text-zinc-950 mb-3 tracking-tight leading-tight">{t("feature3Title")}</h3>
        <p className="text-sm text-zinc-600 leading-relaxed font-medium">{t("feature3Desc")}</p>
      </div>
    </motion.div>
  );
}
