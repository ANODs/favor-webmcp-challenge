"use client";

import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { DeflationChartCard } from "./cards/deflation-chart-card";
import { Unbounded } from "next/font/google";

const unbounded = Unbounded({ subsets: ["latin", "cyrillic"] });

export function FavorHubSection() {
  const t = useTranslations("FavorHub");
  const { data, isLoading } = useQuery({
    queryKey: ["favorHubStats"],
    queryFn: async () => {
      const res = await fetch("/api/subscription/favor/hub-stats", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch favor hub stats");
      const json = await res.json();
      return json.data;
    },
    refetchInterval: 30000, // Poll every 30 seconds
    refetchIntervalInBackground: true,
  });

  const defaultChartData = Array.from({ length: 12 }).map((_, i) => ({
    name: `Point ${i + 1}`,
    burned: 0,
    supply: 1000000000,
  }));

  const maxSupply = data?.maxSupply ?? 1000000000;
  const totalBurned = data?.totalBurned ?? 0;
  const circulatingSupply = data?.circulatingSupply ?? (maxSupply - totalBurned);
  const burnPercent = data?.burnPercent ?? (totalBurned / maxSupply * 100);
  const burnWalletAddress = data?.burnWalletAddress ?? "EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c";
  const chartData = data?.chartData ?? defaultChartData;

  return (
    <section id="favor-hub" className="relative w-full scroll-mt-8">
      <div className="relative z-10 mx-auto mb-8 max-w-3xl text-center sm:mb-10">
        <h2 className={`text-3xl font-extrabold tracking-tight text-zinc-950 sm:text-5xl ${unbounded.className}`}>
          {t("title")}
        </h2>
        <p className="mt-4 text-base sm:text-lg text-zinc-600 max-w-2xl mx-auto leading-relaxed">
          {t("description")}
        </p>
      </div>

      {isLoading && !data ? (
        <div className="w-full">
          <div className="h-[720px] animate-pulse rounded-[2rem] border border-white/10 bg-zinc-900" />
        </div>
      ) : (
        <div className="w-full">
          <DeflationChartCard
            data={chartData}
            totalBurned={totalBurned}
            maxSupply={maxSupply}
            circulatingSupply={circulatingSupply}
            burnPercent={burnPercent}
            burnWalletAddress={burnWalletAddress}
          />
        </div>
      )}
    </section>
  );
}
