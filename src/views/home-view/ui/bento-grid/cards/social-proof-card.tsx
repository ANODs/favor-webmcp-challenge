"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { ReviewCard, type ReviewDto } from "@/entities/review";
import { RatingStars } from "@/shared/ui";

type Props = {
  stats?: {
    latestReview?: ReviewDto | null;
  };
};

export function SocialProofCard({ stats }: Props) {
  const t = useTranslations("Index.Hero");
  return (
    <motion.div
      className="group relative overflow-hidden rounded-[2.5rem] p-6 md:p-8 md:col-span-2 row-span-2 md:row-span-1 shadow-md ring-1 ring-black/10 transition-shadow duration-500 hover:ring-black/20 flex flex-col justify-between"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, ease: "easeOut", delay: 0.4 }}
    >
      <div className="absolute inset-0 bg-gradient-to-tr from-yellow-500/10 to-transparent opacity-50" />
      
      <div className="relative z-10 flex flex-col h-full justify-between">
        <div>
          <h3 className="text-2xl font-bold text-zinc-950 tracking-tight mb-2">
            {t("dashboardRatings")}
          </h3>
          <p className="text-zinc-600 max-w-sm leading-relaxed text-sm">
            {t("businessList3")}
          </p>
        </div>

        {stats?.latestReview ? (
          <div className="mt-6">
            <ReviewCard 
              review={stats.latestReview} 
              className="relative z-10 rounded-2xl bg-white/60 p-5 shadow-md ring-1 ring-black/10 backdrop-blur-md" 
            />
          </div>
        ) : (
          <div className="mt-6 flex items-center gap-4">
            <RatingStars value={5} />
          </div>
        )}
      </div>
    </motion.div>
  );
}
