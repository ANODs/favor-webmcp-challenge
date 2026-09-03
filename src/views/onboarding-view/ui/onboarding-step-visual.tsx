"use client";

import {
  FilePlus2,
  Handshake,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { CURRENT_ONBOARDING_VERSION } from "@/shared/lib/onboarding";

import type { OnboardingStepId } from "../model/steps";

type Props = {
  alt: string;
  locale: "en" | "ru";
  preload: boolean;
  stepId: OnboardingStepId;
};

const STEP_ICONS: Record<OnboardingStepId, LucideIcon> = {
  intro: Sparkles,
  roles: UsersRound,
  feed: Search,
  create: FilePlus2,
  proposal: Handshake,
  deal: ShieldCheck,
  profile: Star,
};

export function OnboardingStepVisual({
  alt,
  locale,
  preload,
  stepId,
}: Props) {
  const imagePath = `/images/onboarding/${locale}/${stepId}.webp?v=${CURRENT_ONBOARDING_VERSION}`;
  const [failedImagePaths, setFailedImagePaths] = useState<Set<string>>(
    () => new Set(),
  );
  const imageFailed = failedImagePaths.has(imagePath);

  return (
    <div className="relative aspect-[4/3] max-h-[27rem] overflow-hidden bg-[linear-gradient(145deg,#09090b_0%,#171717_48%,#0b0fb4_150%)]">
      {imageFailed ? (
        <BrandedFallback alt={alt} stepId={stepId} />
      ) : (
        <Image
          key={imagePath}
          src={imagePath}
          alt={alt}
          fill
          preload={preload}
          unoptimized
          className="object-contain"
          onError={() => {
            setFailedImagePaths((currentPaths) => {
              const nextPaths = new Set(currentPaths);
              nextPaths.add(imagePath);
              return nextPaths;
            });
          }}
        />
      )}
    </div>
  );
}

function BrandedFallback({
  alt,
  stepId,
}: {
  alt: string;
  stepId: OnboardingStepId;
}) {
  const Icon = STEP_ICONS[stepId];

  return (
    <div
      role="img"
      aria-label={alt}
      className="relative flex h-full items-center justify-center overflow-hidden px-8"
    >
      <div
        className="absolute -left-16 -top-20 h-64 w-64 rounded-full bg-brand-pink/30 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-brand-accent/25 blur-3xl"
        aria-hidden="true"
      />

      {stepId === "intro" ? (
        <div
          className="relative flex flex-col items-center gap-5 text-white"
          aria-hidden="true"
        >
          <div className="flex h-28 w-28 items-center justify-center rounded-[2rem] border border-white/15 bg-white/10 shadow-2xl backdrop-blur-xl">
            <Image src="/logo.svg" alt="" width={68} height={68} />
          </div>
          <span className="text-3xl font-black tracking-[0.3em]">FAVOR</span>
        </div>
      ) : (
        <div
          className="relative w-full max-w-md rounded-[2rem] border border-white/15 bg-white/10 p-4 shadow-2xl backdrop-blur-xl sm:p-6"
          aria-hidden="true"
        >
          <div className="mb-5 flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-brand-pink" />
            <span className="h-2.5 w-2.5 rounded-full bg-brand-accent" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/40" />
          </div>
          <div className="grid grid-cols-[auto_1fr] items-center gap-4">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-accent text-zinc-950 shadow-lg">
              <Icon className="h-8 w-8" strokeWidth={1.8} />
            </span>
            <div className="space-y-2.5">
              <span className="block h-3 w-4/5 rounded-full bg-white/85" />
              <span className="block h-2.5 w-full rounded-full bg-white/30" />
              <span className="block h-2.5 w-2/3 rounded-full bg-white/20" />
            </div>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2.5">
            <span className="h-14 rounded-2xl bg-white/10" />
            <span className="h-14 rounded-2xl bg-white/10" />
            <span className="h-14 rounded-2xl bg-white/10" />
          </div>
        </div>
      )}
    </div>
  );
}
