"use client";

import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { Unbounded } from "next/font/google";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";

import { HomeGrainientBackground } from "./home-grainient-background";
import { HeroPhoneErrorBoundary } from "./hero-phone-error-boundary";
import { HomePrimaryActions } from "./home-primary-actions";

const unbounded = Unbounded({ subsets: ["latin", "cyrillic"] });

const HeroPhoneScene = dynamic(
  () => import("./hero-phone-scene").then((module) => module.HeroPhoneScene),
  {
    ssr: false,
    loading: () => null,
  },
);

export function HeroSection() {
  const t = useTranslations("Index.Hero");
  const [phoneStatus, setPhoneStatus] = useState<"loading" | "ready" | "failed">(
    "loading",
  );
  const phoneReady = phoneStatus === "ready";
  const handlePhoneReady = useCallback(() => setPhoneStatus("ready"), []);
  const handlePhoneError = useCallback(() => setPhoneStatus("failed"), []);

  return (
    <section
      className="relative left-1/2 -mt-10 w-screen -translate-x-1/2 bg-black px-3 py-8 sm:px-6 sm:py-10 lg:px-10"
      aria-labelledby="favor-hero-title"
    >
      <div
        className={`relative mx-auto max-w-[1376px] overflow-hidden rounded-[2.75rem] border border-white/15 bg-black shadow-[0_28px_90px_rgba(0,0,0,0.32)] ${
          phoneReady ? "min-h-[760px] sm:min-h-[820px] lg:min-h-[780px]" : "min-h-0"
        }`}
      >
        <div className="absolute inset-0" aria-hidden="true">
          <HomeGrainientBackground />
        </div>

        <div
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.98)_0%,rgba(0,0,0,0.94)_30%,rgba(0,0,0,0.72)_46%,rgba(0,0,0,0.18)_70%,rgba(0,0,0,0.04)_100%)]"
          aria-hidden="true"
        />

        <div
          className={`relative z-10 grid gap-10 px-6 py-12 sm:px-10 sm:py-16 lg:items-center lg:gap-6 lg:px-16 xl:px-20 ${
            phoneReady
              ? "min-h-[760px] sm:min-h-[820px] lg:min-h-[780px] lg:grid-cols-[minmax(0,1.02fr)_minmax(380px,0.98fr)]"
              : "min-h-0"
          }`}
        >
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.65, ease: "easeOut" }}
            className="max-w-[680px] lg:translate-y-6"
          >
            <h1
              id="favor-hero-title"
              className={`${unbounded.className} max-w-[550px] text-[clamp(2.65rem,3.9vw,3.85rem)] font-extrabold leading-[1.06] tracking-[-0.055em] text-white`}
            >
              <span className="hero-title-gradient">{t("title")}</span>
            </h1>

            <p className="mt-7 max-w-[590px] text-base font-medium leading-7 text-zinc-300 sm:text-lg sm:leading-8">
              {t("description")}
            </p>

            <HomePrimaryActions className="mt-9" />
          </motion.div>

          <motion.div
            initial={false}
            animate={phoneReady ? { opacity: 1, y: 0 } : { opacity: 0, y: 28 }}
            transition={{ duration: 0.8, delay: 0.12, ease: "easeOut" }}
            aria-hidden={!phoneReady}
            className={
              phoneReady
                ? "relative flex min-h-[560px] items-center justify-center lg:min-h-0 lg:justify-end"
                : "pointer-events-none absolute right-0 top-1/2 h-[720px] w-full max-w-[540px] -translate-y-1/2"
            }
          >
            <div className="relative w-full max-w-[500px] lg:-translate-x-6 lg:translate-y-2 xl:max-w-[540px]">
              <HeroPhoneErrorBoundary onError={handlePhoneError}>
                {phoneStatus !== "failed" ? (
                  <HeroPhoneScene onReady={handlePhoneReady} />
                ) : null}
              </HeroPhoneErrorBoundary>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
