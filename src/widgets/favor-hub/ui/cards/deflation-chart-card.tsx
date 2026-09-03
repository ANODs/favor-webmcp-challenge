"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, ExternalLink, Flame, Globe2 } from "lucide-react";
import { motion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { siteConfig } from "@/shared/config";

type ChartPoint = {
  name: string;
  burned: number;
  supply: number;
};

type DeflationChartCardProps = {
  data: ChartPoint[];
  totalBurned: number;
  maxSupply: number;
  circulatingSupply: number;
  burnPercent: number;
  burnWalletAddress: string;
};

type CustomTooltipProps = {
  active?: boolean;
  payload?: Array<{ value?: number | string }>;
  maxSupply?: number;
  localeCode?: string;
};

const normalizeChartData = (data: ChartPoint[], totalBurned: number, maxSupply: number) => {
  const points = data
    .filter((point) => Number.isFinite(point.burned))
    .map((point) => {
      const burned = Math.max(0, point.burned);

      return {
        ...point,
        burned,
        supply: Math.max(0, maxSupply - burned),
      };
    });

  if (points.length === 0) {
    return [
      {
        name: "Current",
        burned: totalBurned,
        supply: Math.max(0, maxSupply - totalBurned),
      },
    ];
  }

  return points.map((point, index) => {
    if (index !== points.length - 1) {
      return point;
    }

    return {
      ...point,
      burned: totalBurned,
      supply: Math.max(0, maxSupply - totalBurned),
    };
  });
};

const getChartDomain = (data: ChartPoint[]) => {
  const maxBurned = Math.max(...data.map((point) => point.burned), 0);

  return [0, Math.max(1, maxBurned * 1.12)] as [number, number];
};

function CustomTooltip({
  active,
  payload,
  maxSupply = 0,
  localeCode = "en-US",
}: CustomTooltipProps) {
  if (!active || !payload?.length) {
    return null;
  }

  const burned = Number(payload[0].value ?? 0);

  return (
    <div className="rounded-xl border border-white/10 bg-zinc-950/95 px-3 py-2.5 shadow-xl backdrop-blur-sm">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
        Cumulative burn
      </p>
      <p className="mt-1 text-base font-bold text-brand-accent">
        {Math.round(burned).toLocaleString(localeCode)} FAVOR
      </p>
      <p className="mt-1 text-[10px] text-zinc-500">
        {((burned / Math.max(1, maxSupply)) * 100).toFixed(6)}%
      </p>
    </div>
  );
}

export function DeflationChartCard({
  data,
  totalBurned,
  maxSupply,
  circulatingSupply,
  burnPercent,
  burnWalletAddress,
}: DeflationChartCardProps) {
  const t = useTranslations("FavorHub");
  const locale = useLocale();
  const localeCode = locale === "ru" ? "ru-RU" : "en-US";
  const [copied, setCopied] = useState(false);
  const chartData = useMemo(
    () => normalizeChartData(data, totalBurned, maxSupply),
    [data, maxSupply, totalBurned],
  );
  const chartDomain = useMemo(() => getChartDomain(chartData), [chartData]);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timeoutId = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timeoutId);
  }, [copied]);

  const copyAddress = async () => {
    await navigator.clipboard.writeText(burnWalletAddress);
    setCopied(true);
  };

  const formatTokenAmount = (value: number) =>
    Math.round(value).toLocaleString(localeCode);
  const formatPercentTick = (value: number) => {
    if (value === 0) {
      return "0%";
    }

    return `${((value / Math.max(1, maxSupply)) * 100).toFixed(4)}%`;
  };

  return (
    <motion.article
      className="relative overflow-hidden rounded-[2rem] border border-white/15 bg-[#0a0a0a] text-white shadow-[0_24px_80px_rgba(0,0,0,0.28)]"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.55, ease: "easeOut" }}
    >
      <div className="px-5 pb-0 pt-6 sm:px-8 sm:pt-8 lg:px-10 lg:pt-10">
        <header className="max-w-xl">
          <h3 className="text-2xl font-black tracking-[-0.035em] sm:text-3xl">
            {t("liveDeflation")}
          </h3>
          <p className="mt-3 max-w-lg text-sm font-medium leading-6 text-zinc-400 sm:text-base">
            {t("cardDescription")}
          </p>
        </header>

        <div className="mt-5 grid overflow-hidden rounded-3xl border border-white/15 sm:mt-6 sm:grid-cols-2">
          <div className="flex min-w-0 items-center gap-4 px-5 py-6 sm:gap-5 sm:px-7 sm:py-7 lg:px-9">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center text-orange-500 sm:h-16 sm:w-16">
              <Flame aria-hidden="true" className="h-full w-full fill-current stroke-[1.5]" />
            </span>
            <div className="min-w-0">
              <p className="text-4xl font-black tracking-[-0.045em] text-white sm:text-5xl lg:text-6xl">
                {formatTokenAmount(totalBurned)}
              </p>
              <p className="mt-2 text-xs font-medium text-zinc-400 sm:text-sm">
                {t("totalBurnedLabel")}
              </p>
            </div>
          </div>

          <div className="flex min-w-0 items-center border-t border-white/15 px-5 py-6 sm:border-l sm:border-t-0 sm:px-7 sm:py-7 lg:px-9">
            <div className="min-w-0">
              <p className="text-4xl font-black tracking-[-0.045em] text-[#54E9A7] sm:text-5xl lg:text-6xl">
                {burnPercent.toFixed(6)}%
              </p>
              <p className="mt-2 text-xs font-medium text-zinc-400 sm:text-sm">
                {t("totalDeflated")}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 grid overflow-hidden rounded-3xl border border-white/15 sm:grid-cols-2">
          <MetricCell label={t("circulatingSupply")} className="border-b border-white/15">
            <p className="text-2xl font-black tracking-[-0.035em] sm:text-3xl">
              {formatTokenAmount(circulatingSupply)}
            </p>
            <p className="mt-1.5 text-xs font-medium text-zinc-500">{t("favorTokens")}</p>
          </MetricCell>

          <MetricCell
            label={t("totalSupply")}
            className="border-b border-white/15 sm:border-l"
          >
            <p className="text-2xl font-black tracking-[-0.035em] sm:text-3xl">
              {formatTokenAmount(maxSupply)}
            </p>
            <p className="mt-1.5 text-xs font-medium text-zinc-500">{t("fixedEmission")}</p>
          </MetricCell>

          <div className="flex min-w-0 items-center justify-between gap-4 border-b border-white/15 px-5 py-5 sm:border-b-0 sm:px-7">
            <div className="min-w-0">
              <p className="text-xs font-medium text-zinc-400">{t("burnWallet")}</p>
              <p className="mt-2 truncate font-mono text-xs text-zinc-300 sm:text-sm">
                {burnWalletAddress}
              </p>
            </div>
            <button
              type="button"
              onClick={copyAddress}
              className="shrink-0 rounded-xl p-2 text-zinc-400 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
              aria-label={copied ? t("walletCopied") : t("copyWallet")}
              title={copied ? t("walletCopied") : t("copyWallet")}
            >
              {copied ? (
                <Check aria-hidden="true" className="h-5 w-5 text-brand-accent" />
              ) : (
                <Copy aria-hidden="true" className="h-5 w-5" />
              )}
            </button>
          </div>

          <div className="grid grid-cols-2 sm:border-l sm:border-white/15">
            <ExternalAction href={siteConfig.links.dexscreener} icon={<Globe2 />}>
              Dexscreener
            </ExternalAction>
            <ExternalAction
              href={siteConfig.links.stonfi}
              icon={<ExternalLink />}
              className="border-l border-white/15"
            >
              STON.fi
            </ExternalAction>
          </div>
        </div>
      </div>

      <div className="relative mt-4 h-52 overflow-hidden sm:mt-5 sm:h-60 lg:h-64">
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-[radial-gradient(ellipse_at_bottom,rgba(255,45,123,0.17),transparent_68%)]"
          aria-hidden="true"
        />
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          <AreaChart
            data={chartData}
            margin={{ top: 12, right: 24, left: 2, bottom: 14 }}
          >
            <defs>
              <linearGradient id="favorBurnArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#54E9A7" stopOpacity={0.32} />
                <stop offset="100%" stopColor="#54E9A7" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={42}
              tickFormatter={(name: string) => (name.startsWith("Point ") ? "" : name)}
              tick={{ fill: "#71717a", fontSize: 11 }}
              tickMargin={12}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              domain={chartDomain}
              tickCount={3}
              tickFormatter={formatPercentTick}
              width={66}
              tick={{ fill: "#71717a", fontSize: 11 }}
            />
            <Tooltip
              content={
                <CustomTooltip maxSupply={maxSupply} localeCode={localeCode} />
              }
              cursor={{ stroke: "rgba(84, 233, 167, 0.2)", strokeWidth: 1 }}
            />
            <Area
              type="monotone"
              dataKey="burned"
              stroke="#54E9A7"
              strokeWidth={3}
              fill="url(#favorBurnArea)"
              fillOpacity={1}
              isAnimationActive
              animationDuration={900}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.article>
  );
}

function MetricCell({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-w-0 px-5 py-5 sm:px-7 ${className}`}>
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 sm:text-xs">
        {label}
      </p>
      {children}
    </div>
  );
}

function ExternalAction({
  href,
  icon,
  children,
  className = "",
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex min-w-0 items-center justify-center gap-2 px-3 py-5 text-xs font-medium text-zinc-300 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-accent sm:text-sm ${className}`}
    >
      <span className="h-5 w-5 shrink-0 text-zinc-400 [&>svg]:h-full [&>svg]:w-full" aria-hidden="true">
        {icon}
      </span>
      <span className="truncate">{children}</span>
    </a>
  );
}
