"use client";

import { useTranslations } from "next-intl";

import type { PlatformStats } from "../../server";

import { VisualShowcaseCard } from "./cards/visual-showcase";
import { AnalyticsCard } from "./cards/analytics-card";
import { SocialProofCard } from "./cards/social-proof-card";
import { NoThirdPartyAppsCard } from "./cards/no-third-party-apps-card";
import { FixingPriceCard } from "./cards/fixing-price-card";
import { QuickLaunchCard } from "./cards/quick-launch-card";
import { NoChaosCard } from "./cards/no-chaos-card";

export function BentoGrid({ stats }: { stats?: PlatformStats }) {
  const t = useTranslations("Index.Hero");

  return (
    <section className="relative w-full">
      <div className="mb-16 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-zinc-950 sm:text-5xl">
          {t("bentoTitle")}
        </h2>
        <p className="mt-4 text-lg text-zinc-600 max-w-2xl mx-auto">
          {t("bentoSubtitle")}
        </p>
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-4 md:grid-rows-4 max-w-6xl mx-auto auto-rows-[220px]">
        {/* Row 1-2, Col 1-2 */}
        <VisualShowcaseCard />
        
        {/* Row 1, Col 3-4 */}
        <AnalyticsCard stats={stats} />
        
        {/* Row 2, Col 3-4 */}
        <SocialProofCard stats={stats} />

        {/* Row 3-4, Col 1 */}
        <NoThirdPartyAppsCard />

        {/* Row 3, Col 2-3 */}
        <FixingPriceCard />

        {/* Row 3-4, Col 4 */}
        <NoChaosCard />

        {/* Row 4, Col 2-3 */}
        <QuickLaunchCard />
      </div>
    </section>
  );
}
