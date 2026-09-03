"use client";

import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, CircleAlert } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { authClient, sessionQueryKeys } from "@/entities/session";
import { useRouter } from "@/i18n/routing";
import { routes } from "@/shared/config/routes";
import { triggerTelegramNotification } from "@/shared/lib/telegram/client";
import type { CurrentSessionUserDto } from "@/shared/types/session-user";
import { Button, SurfaceCard, useDialogBackButton } from "@/shared/ui";

import {
  ONBOARDING_STEP_COUNT,
  ONBOARDING_STEP_IDS,
} from "../model/steps";
import { OnboardingStepVisual } from "./onboarding-step-visual";

type Props = {
  requiresCompletion: boolean;
  returnTo: string;
};

type PointerStart = {
  x: number;
  y: number;
};

type NavigationState = {
  direction: 1 | -1;
  stepIndex: number;
};

const SWIPE_THRESHOLD_PX = 56;

export function OnboardingView({ requiresCompletion, returnTo }: Props) {
  const t = useTranslations("Onboarding");
  const locale = useLocale() === "en" ? "en" : "ru";
  const router = useRouter();
  const queryClient = useQueryClient();
  const prefersReducedMotion = useReducedMotion();
  const [navigation, setNavigation] = useState<NavigationState>({
    direction: 1,
    stepIndex: 0,
  });
  const [completionTarget, setCompletionTarget] = useState<string | null>(null);
  const [completionError, setCompletionError] = useState(false);
  const completionTargetRef = useRef<string | null>(null);
  const mainRef = useRef<HTMLElement>(null);
  const mountedStepIdRef = useRef<string | null>(null);
  const pointerStartRef = useRef<PointerStart | null>(null);

  const { direction, stepIndex } = navigation;
  const stepId = ONBOARDING_STEP_IDS[stepIndex];
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === ONBOARDING_STEP_COUNT - 1;
  const isReplay = !requiresCompletion;

  const goToStep = useCallback((nextIndex: number) => {
    const boundedIndex = Math.max(
      0,
      Math.min(ONBOARDING_STEP_COUNT - 1, nextIndex),
    );

    setNavigation((currentNavigation) => {
      if (currentNavigation.stepIndex === boundedIndex) {
        return currentNavigation;
      }

      const nextNavigation: NavigationState = {
        direction:
          boundedIndex > currentNavigation.stepIndex ? 1 : -1,
        stepIndex: boundedIndex,
      };
      return nextNavigation;
    });
  }, []);

  const completeAndNavigate = useCallback(
    async (target: string) => {
      if (completionTargetRef.current) {
        return;
      }

      completionTargetRef.current = target;
      setCompletionTarget(target);
      setCompletionError(false);

      if (!requiresCompletion) {
        router.replace(target);
        return;
      }

      try {
        const currentUser = await authClient.completeOnboarding();
        const cachedUser = queryClient.getQueryData<CurrentSessionUserDto | null>(
          sessionQueryKeys.currentUser,
        );

        if (cachedUser) {
          queryClient.setQueryData<CurrentSessionUserDto | null>(
            sessionQueryKeys.currentUser,
            (previousUser) =>
              previousUser
                ? {
                    ...previousUser,
                    onboardingVersion: currentUser.onboardingVersion,
                  }
                : previousUser,
          );
        } else {
          void queryClient.invalidateQueries({
            queryKey: sessionQueryKeys.currentUser,
            refetchType: "all",
          });
        }
        router.replace(target);
      } catch {
        completionTargetRef.current = null;
        setCompletionTarget(null);
        setCompletionError(true);
        triggerTelegramNotification("error");
      }
    },
    [queryClient, requiresCompletion, router],
  );

  const handleBack = useCallback(() => {
    if (stepIndex > 0) {
      goToStep(stepIndex - 1);
      return;
    }

    void completeAndNavigate(returnTo);
  }, [completeAndNavigate, goToStep, returnTo, stepIndex]);

  const handleNext = useCallback(() => {
    if (!isLastStep) {
      goToStep(stepIndex + 1);
    }
  }, [goToStep, isLastStep, stepIndex]);

  useDialogBackButton(true, handleBack);

  const handleStepMount = useCallback((element: HTMLDivElement | null) => {
    if (!element) {
      return;
    }

    const mountedStepId = element.dataset.onboardingStep;
    if (!mountedStepId || mountedStepIdRef.current === mountedStepId) {
      return;
    }

    const isInitialStep = mountedStepIdRef.current === null;
    mountedStepIdRef.current = mountedStepId;
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }

    if (!isInitialStep) {
      element
        .querySelector<HTMLHeadingElement>("h1")
        ?.focus({ preventScroll: true });
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }

      if (event.key === "ArrowLeft" && !isFirstStep) {
        event.preventDefault();
        handleBack();
      }

      if (event.key === "ArrowRight" && !isLastStep) {
        event.preventDefault();
        handleNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleBack, handleNext, isFirstStep, isLastStep]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType === "mouse") {
      return;
    }

    pointerStartRef.current = { x: event.clientX, y: event.clientY };
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    const pointerStart = pointerStartRef.current;
    pointerStartRef.current = null;

    if (!pointerStart || event.pointerType === "mouse") {
      return;
    }

    const deltaX = event.clientX - pointerStart.x;
    const deltaY = event.clientY - pointerStart.y;
    if (
      Math.abs(deltaX) < SWIPE_THRESHOLD_PX ||
      Math.abs(deltaX) <= Math.abs(deltaY)
    ) {
      return;
    }

    if (deltaX < 0 && !isLastStep) {
      handleNext();
    } else if (deltaX > 0 && !isFirstStep) {
      handleBack();
    }
  };

  return (
    <main
      ref={mainRef}
      data-theme="dark"
      className="theme-shell relative isolate h-[100svh] overflow-x-hidden overflow-y-auto overscroll-y-contain bg-[var(--background)] text-[var(--foreground)] [color-scheme:dark]"
    >
      <div
        className="pointer-events-none absolute -left-32 top-16 h-72 w-72 rounded-full bg-brand-pink/10 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-36 bottom-16 h-80 w-80 rounded-full bg-brand-accent/10 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative mx-auto flex min-h-[100svh] w-full max-w-3xl flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6">
        <header className="mb-3 flex items-center justify-between gap-2 min-[300px]:gap-4 sm:mb-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-zinc-950 shadow-sm">
              <Image src="/logo.svg" alt="" width={23} height={23} />
            </span>
            <div className="hidden min-[240px]:block">
              <p className="text-sm font-bold tracking-tight">Favor</p>
              <p className="hidden text-xs text-[var(--muted-foreground)] min-[300px]:block">
                {t("guideLabel")}
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={completionTarget !== null}
            onClick={() => void completeAndNavigate(returnTo)}
            className="rounded-xl px-2 py-2 text-sm font-semibold text-[var(--muted-foreground)] outline-none transition hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)] focus-visible:ring-2 focus-visible:ring-brand-accent-ink disabled:pointer-events-none disabled:opacity-50 min-[300px]:px-3"
          >
            {isReplay ? t("close") : t("skip")}
          </button>
        </header>

        <div className="mb-3 sm:mb-4">
          <div className="mb-2 flex items-center justify-between gap-4 text-xs font-semibold text-[var(--muted-foreground)]">
            <span>
              {t("progress", {
                current: stepIndex + 1,
                total: ONBOARDING_STEP_COUNT,
              })}
            </span>
            <span>{Math.round(((stepIndex + 1) / ONBOARDING_STEP_COUNT) * 100)}%</span>
          </div>
          <div
            role="progressbar"
            aria-label={t("progressLabel")}
            aria-valuemin={1}
            aria-valuemax={ONBOARDING_STEP_COUNT}
            aria-valuenow={stepIndex + 1}
            aria-valuetext={t("progress", {
              current: stepIndex + 1,
              total: ONBOARDING_STEP_COUNT,
            })}
            className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-muted)]"
          >
            <motion.div
              className="h-full origin-left rounded-full bg-brand-accent"
              animate={{ scaleX: (stepIndex + 1) / ONBOARDING_STEP_COUNT }}
              initial={false}
              transition={
                prefersReducedMotion
                  ? { duration: 0 }
                  : { duration: 0.28, ease: "easeOut" }
              }
            />
          </div>
        </div>

        <div
          className="flex min-h-0 flex-1 touch-pan-y items-start"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => {
            pointerStartRef.current = null;
          }}
        >
          <AnimatePresence initial={false} mode="wait" custom={direction}>
            <motion.div
              ref={handleStepMount}
              key={stepId}
              data-onboarding-step={stepId}
              custom={direction}
              initial={
                prefersReducedMotion
                  ? { opacity: 1 }
                  : { opacity: 0, x: direction * 28 }
              }
              animate={{ opacity: 1, x: 0 }}
              exit={
                prefersReducedMotion
                  ? { opacity: 1 }
                  : { opacity: 0, x: direction * -20 }
              }
              transition={
                prefersReducedMotion
                  ? { duration: 0 }
                  : { duration: 0.22, ease: "easeOut" }
              }
              className="w-full"
            >
              <SurfaceCard
                paddingClassName="p-0"
                className="overflow-hidden bg-[var(--surface)]"
              >
                <OnboardingStepVisual
                  alt={t(`steps.${stepId}.imageAlt`)}
                  locale={locale}
                  preload={isFirstStep}
                  stepId={stepId}
                />

                <div className="p-5 sm:p-7">
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-brand-accent-ink dark:text-brand-accent">
                    {t(`steps.${stepId}.eyebrow`)}
                  </p>
                  <h1
                    tabIndex={-1}
                    className="text-balance text-2xl font-black tracking-tight outline-none sm:text-3xl"
                  >
                    {t(`steps.${stepId}.title`)}
                  </h1>
                  <p className="mt-3 text-pretty text-sm leading-6 text-[var(--muted-foreground)] sm:text-base sm:leading-7">
                    {t(`steps.${stepId}.description`)}
                  </p>

                  <div className="mt-4 flex gap-3 rounded-2xl border border-black/5 bg-[var(--background)] p-3.5 dark:border-white/10">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-accent text-zinc-950">
                      <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
                    </span>
                    <p className="text-sm font-medium leading-6">
                      {t(`steps.${stepId}.instruction`)}
                    </p>
                  </div>
                </div>
              </SurfaceCard>
            </motion.div>
          </AnimatePresence>
        </div>

        {completionError ? (
          <p
            role="alert"
            className="mt-3 flex items-start gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium leading-5 text-red-700 dark:bg-red-950/30 dark:text-red-300"
          >
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {t("completionError")}
          </p>
        ) : null}

        <nav
          aria-label={t("navigationLabel")}
          className="mt-4 shrink-0"
        >
          {isLastStep ? (
            <div className="space-y-2.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleBack}
                disabled={completionTarget !== null}
                className="-ml-2"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                {t("back")}
              </Button>
              <div className="grid grid-cols-1 gap-2.5 min-[360px]:grid-cols-2">
                <Button
                  type="button"
                  variant="accent"
                  size="lg"
                  shape="rounded-2xl"
                  fullWidth
                  loading={completionTarget === routes.feed}
                  disabled={completionTarget !== null}
                  onClick={() => void completeAndNavigate(routes.feed)}
                  className="px-3"
                >
                  {t("viewFeed")}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  shape="rounded-2xl"
                  fullWidth
                  loading={completionTarget === routes.createContract}
                  disabled={completionTarget !== null}
                  onClick={() =>
                    void completeAndNavigate(routes.createContract)
                  }
                  className="px-3"
                >
                  {t("createListing")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="secondary"
                size="lg"
                shape="rounded-2xl"
                fullWidth
                onClick={handleBack}
                disabled={isFirstStep || completionTarget !== null}
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                {t("back")}
              </Button>
              <Button
                type="button"
                variant="primary"
                size="lg"
                shape="rounded-2xl"
                fullWidth
                onClick={handleNext}
                disabled={completionTarget !== null}
              >
                {t("next")}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          )}
        </nav>
      </div>
    </main>
  );
}
