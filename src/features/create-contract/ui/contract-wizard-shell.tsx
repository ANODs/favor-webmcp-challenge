import { Unbounded } from "next/font/google";
import { ArrowRight } from "lucide-react";
import type { RefObject, ReactNode } from "react";

import { Button, SurfaceCard } from "@/shared/ui";

const unbounded = Unbounded({ subsets: ["latin", "cyrillic"] });

export const CONTRACT_WIZARD_STEP_COUNT = 3;

type Props = {
  activeStep: number;
  stepLabels: string[];
  stepCounter: string;
  title: string;
  description: string;
  children: ReactNode;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  primaryLabel: string;
  autosaveLabel: string;
  showFooter?: boolean;
  primaryDisabled?: boolean;
  primaryLoading?: boolean;
  compact?: boolean;
};

export function ContractWizardShell({
  activeStep,
  stepLabels,
  stepCounter,
  title,
  description,
  children,
  scrollContainerRef,
  primaryLabel,
  showFooter = true,
  primaryDisabled = false,
  primaryLoading = false,
  compact = false,
}: Props) {
  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div
        ref={scrollContainerRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        <div
          className={`mx-auto w-full max-w-5xl transition-[padding-bottom] duration-300 ${
            compact ? "px-3 pt-3" : "px-4 pt-5 sm:px-6 sm:pt-7 lg:px-8"
          } ${
            showFooter
              ? compact
                ? "pb-20"
                : "pb-28 sm:pb-32"
              : compact
                ? "pb-6"
                : "pb-12 sm:pb-16"
          }`}
        >
          <div
            className="mx-auto w-full max-w-3xl"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={CONTRACT_WIZARD_STEP_COUNT}
            aria-valuenow={activeStep + 1}
            aria-label={stepCounter}
          >
            <p
              className={`text-center font-semibold uppercase tracking-[0.16em] text-zinc-500 ${
                compact ? "text-[9px]" : "text-xs"
              }`}
            >
              {stepCounter}
            </p>
            <div
              className={`grid grid-cols-3 ${
                compact ? "mt-2 gap-1.5" : "mt-3 gap-2 sm:gap-3"
              }`}
            >
              {stepLabels.map((label, index) => {
                const isComplete = index < activeStep;
                const isActive = index === activeStep;

                return (
                  <div key={label} className="min-w-0">
                    <div
                      className={`h-1 rounded-full transition-colors ${
                        isComplete || isActive
                          ? "bg-brand-accent shadow-[0_0_12px_rgba(117,247,96,0.28)]"
                          : "bg-zinc-200 dark:bg-white/15"
                      }`}
                    />
                    <p
                      aria-current={isActive ? "step" : undefined}
                      className={`${compact ? "mt-1.5 text-[9px]" : "mt-2 text-[11px] sm:text-xs"} truncate text-center font-semibold ${
                        isActive
                          ? "text-brand-accent-ink dark:text-brand-accent"
                          : isComplete
                            ? "text-zinc-700 dark:text-zinc-300"
                          : "text-zinc-500"
                      }`}
                    >
                      {label}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <header className={compact ? "mt-4" : "mt-8 sm:mt-10"}>
            <h1
              className={`${unbounded.className} max-w-4xl font-extrabold leading-[1.08] tracking-[-0.045em] text-zinc-950 ${
                compact ? "text-[19px]" : "text-3xl sm:text-4xl lg:text-[2.75rem]"
              }`}
            >
              {title}
            </h1>
            <p
              className={`max-w-2xl font-medium text-zinc-600 ${
                compact ? "mt-1.5 text-[10px] leading-4" : "mt-3 text-sm leading-6 sm:text-base"
              }`}
            >
              {description}
            </p>
          </header>

          <SurfaceCard
            className={`${compact ? "mt-3 rounded-[1.5rem]" : "mt-6 rounded-[2rem] sm:mt-8"} overflow-hidden shadow-[0_18px_48px_rgba(9,9,11,0.08)]`}
            paddingClassName={compact ? "p-3.5" : "p-5 sm:p-7 lg:p-8"}
          >
            {children}
          </SurfaceCard>
        </div>
      </div>

      <footer
        className={`absolute bottom-0 left-0 right-0 z-10 pointer-events-none pt-2 transition-all duration-300 ease-out ${
          compact ? "px-3 pb-3" : "px-4 pb-5 sm:px-6 sm:pb-6 lg:px-8"
        } ${
          showFooter
            ? "translate-y-0 opacity-100"
            : "translate-y-8 opacity-0"
        }`}
      >
        <div className="mx-auto flex w-full max-w-3xl items-center">
          <Button
            type="submit"
            variant="accent"
            shape="rounded-2xl"
            size="lg"
            loading={primaryLoading}
            disabled={primaryDisabled || !showFooter}
            className={`${compact ? "h-11 text-sm" : "h-14 text-base"} pointer-events-auto w-full font-bold transition-transform active:scale-[0.98]`}
          >
            {primaryLabel}
            {!primaryLoading && activeStep < CONTRACT_WIZARD_STEP_COUNT - 1 ? (
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            ) : null}
          </Button>
        </div>
      </footer>
    </div>
  );
}

