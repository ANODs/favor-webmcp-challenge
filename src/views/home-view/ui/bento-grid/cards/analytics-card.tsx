"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { BarChart, Bar, ResponsiveContainer, Tooltip } from "recharts";

type ChartPoint = { name: string; value: number };
type AnalyticsStats = { totalDeals: number; chartData: ChartPoint[] };
type AnalyticsTooltipProps = {
  active?: boolean;
  payload?: ReadonlyArray<{ value?: number | string }>;
  label?: number | string;
  metricLabel: string;
};

const chartData: ChartPoint[] = Array.from({ length: 24 }).map((_, i) => ({
  name: String(i + 1),
  value: 0,
}));

function AnalyticsTooltip({ active, payload, label, metricLabel }: AnalyticsTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-white/90 border border-black/10 rounded-xl p-3 shadow-md backdrop-blur-md">
      <p className="text-zinc-600 text-xs font-medium mb-1">{`${label}:00`}</p>
      <p className="text-sm font-bold text-brand-accent">{`${payload[0].value} ${metricLabel}`}</p>
    </div>
  );
}

export function AnalyticsCard({ stats }: { stats?: AnalyticsStats }) {
  const t = useTranslations("Index.Hero");
  const metricLabel = t("dashboardAnalytics");

  return (
    <motion.div
      className="group relative overflow-hidden rounded-[2.5rem] p-8 md:col-span-2 md:row-span-1 shadow-md ring-1 ring-black/10 transition-shadow duration-500 hover:ring-black/20 flex flex-col justify-between"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-zinc-900">{t("dashboardAnalytics")}</h3>
          <div className="mt-2 text-4xl font-bold tracking-tight text-zinc-950">
            {stats ? stats.totalDeals.toLocaleString() : t("dashboardTotalVal")}
          </div>
        </div>

      </div>
      <div className="h-24 w-full mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={stats?.chartData || chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <Tooltip
              content={<AnalyticsTooltip metricLabel={metricLabel} />}
              cursor={{ fill: 'rgba(255,255,255,0.05)' }}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} fill="var(--color-brand-accent)" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
