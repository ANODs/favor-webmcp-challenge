"use client";

import { LaptopMinimal, MoonStar, SunMedium } from "lucide-react";
import { useTranslations } from "next-intl";

import { type ThemePreference } from "@/shared/store/theme-store";
import { SurfaceCard } from "@/shared/ui/surface-card";

type Props = {
  theme: ThemePreference;
  onSelectTheme: (theme: ThemePreference) => void;
};

const themeOptions: Array<{
  value: ThemePreference;
  labelKey: any;
  icon: typeof SunMedium;
}> = [
  {
    value: "light",
    labelKey: "ThemeLight",
    icon: SunMedium,
  },
  {
    value: "dark",
    labelKey: "ThemeDark",
    icon: MoonStar,
  },
  {
    value: "system",
    labelKey: "ThemeSystem",
    icon: LaptopMinimal,
  },
];

export function ThemePreferenceCard({ theme, onSelectTheme }: Props) {
  const t = useTranslations("Settings");

  return (
    <SurfaceCard>
      <div>
        <h2 className="text-lg font-semibold text-zinc-950">{t("ThemeTitle")}</h2>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        {themeOptions.map((option) => {
          const isActive = theme === option.value;
          const Icon = option.icon;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onSelectTheme(option.value)}
              className={`flex min-h-28 flex-col items-center justify-center rounded-3xl border px-3 py-4 text-center transition ${
                isActive
                  ? "border-zinc-950 bg-zinc-950 text-white"
                  : "border-zinc-200 bg-zinc-50 text-zinc-900 hover:bg-zinc-100"
              }`}
            >
              <Icon className={`h-6 w-6 ${isActive ? "text-white" : "text-zinc-700"}`} />
              <p className={`mt-3 text-xs font-semibold ${isActive ? "text-white" : "text-zinc-700"}`}>
                {t(option.labelKey)}
              </p>
            </button>
          );
        })}
      </div>
    </SurfaceCard>
  );
}
