"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Unbounded } from "next/font/google";
import { useTranslations } from "next-intl";

import { HomePrimaryActions } from "../home-primary-actions";
import type { WorkflowFrame, WorkflowStepId } from "./model/types";

const unbounded = Unbounded({ subsets: ["latin", "cyrillic"] });

type Props = {
  animateTransitions: boolean;
  frame: WorkflowFrame;
};

const stepCopyKeys: Record<
  WorkflowStepId,
  "telegram" | "post" | "contract" | "share" | "reputation"
> = {
  "work-in-telegram": "telegram",
  "reuse-post": "post",
  "build-contract": "contract",
  "share-contract": "share",
  "manage-deal": "reputation",
};

const DEAL_STATUS_STAGE_IDS = new Set([
  "deal-status-pending",
  "deal-status-progress",
  "deal-status-result",
  "deal-status-payment",
  "deal-status",
]);

export function WorkflowCopyPanels({ animateTransitions, frame }: Props) {
  const t = useTranslations("Index.Workflow");
  const selectedStageId =
    frame.screen.blend >= 0.5
      ? frame.screen.toStageId
      : frame.screen.fromStageId;
  const shareLine =
    selectedStageId === "share-inline" ||
    selectedStageId === "share-inline-typing"
      ? t("share.lineInline")
      : selectedStageId === "share-sent"
        ? t("share.lineResult")
        : t("share.lineMiniApp");
  const reputationLine =
    DEAL_STATUS_STAGE_IDS.has(selectedStageId)
      ? t("reputation.lineStatus")
      : selectedStageId === "deal-review"
        ? t("reputation.lineReview")
        : selectedStageId === "deal-complete"
          ? t("reputation.lineFinal")
          : t("reputation.lineQuestions");
  return (
    <div className="static z-20 flex h-[46%] min-h-0 flex-col justify-start px-7 pb-0 pt-10 sm:h-[44%] sm:px-12 sm:pt-12 lg:relative lg:h-full lg:justify-center lg:px-14 lg:pb-4 lg:pt-12">
      <p className="sr-only" aria-live="polite">
        {t("progressLabel", { current: frame.activeStep.index + 1, total: 5 })}
      </p>

      <ol className="relative grid min-h-0 lg:block lg:flex-1">
        {frame.leftPanels.map((panel) => {
          const key = stepCopyKeys[panel.stepId];
          const title =
            panel.stepId === "share-contract"
              ? shareLine
              : panel.stepId === "manage-deal"
                ? reputationLine
                : t(`${key}.title`);
          const Heading = panel.stepId === "work-in-telegram" ? "h1" : "h2";

          return (
            <li
              key={panel.stepId}
              aria-hidden={!panel.isActive}
              className={`${panel.isVisible ? "flex" : "hidden"} relative col-start-1 row-start-1 flex-col justify-start pt-1 will-change-[opacity,transform,filter] lg:absolute lg:inset-0 lg:flex lg:justify-center lg:pt-0`}
              style={{
                filter: `blur(${Math.max(0, 1 - panel.opacity) * 8}px)`,
                opacity: panel.opacity,
                transform: `translate3d(${panel.translateX}px, ${panel.translateY}px, 0) scale(${panel.scale})`,
                visibility: panel.isVisible ? "visible" : "hidden",
              }}
            >
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-accent sm:text-xs">
                {t(`${key}.eyebrow`)}
              </p>
              <Heading
                className={`${unbounded.className} mt-4 ${title.includes("\n") ? "whitespace-pre" : "whitespace-pre-line"} text-[clamp(1.85rem,3.65vw,3.4rem)] font-extrabold leading-[0.98] tracking-[-0.065em] text-white sm:mt-5 lg:mt-6`}
              >
                <AnimatePresence initial={false} mode="wait">
                  <motion.span
                    key={title}
                    className="block"
                    initial={
                      animateTransitions ? { opacity: 0, y: 14 } : false
                    }
                    animate={{ opacity: 1, y: 0 }}
                    exit={{
                      opacity: 0,
                      y: -10,
                      transition: animateTransitions
                        ? { duration: 0.12 }
                        : { duration: 0 },
                    }}
                    transition={
                      animateTransitions
                        ? {
                            duration: 0.22,
                            ease: [0.22, 1, 0.36, 1],
                          }
                        : { duration: 0 }
                    }
                  >
                    {title}
                  </motion.span>
                </AnimatePresence>
              </Heading>
              <p className="mt-4 max-w-[540px] text-sm font-medium leading-5 text-zinc-400 sm:mt-5 sm:text-base sm:leading-6 lg:mt-6 lg:text-lg lg:leading-7">
                {t(`${key}.description`)}
              </p>
            </li>
          );
        })}
      </ol>

      <HomePrimaryActions
        compact
        className="relative z-30 mt-3 shrink-0 lg:mt-5"
      />

      <div
        className="absolute bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center justify-center gap-2 lg:hidden"
        aria-hidden="true"
      >
        {frame.leftPanels.map((panel) => (
          <span
            key={panel.stepId}
            className={`h-1.5 rounded-full transition-[width,background-color] duration-200 ${
              panel.isActive ? "w-10 bg-brand-accent" : "w-4 bg-white/20"
            }`}
          />
        ))}
      </div>

      <div
        className="absolute left-4 top-1/2 hidden -translate-y-1/2 flex-col items-center gap-2 lg:flex"
        aria-hidden="true"
      >
        {frame.leftPanels.map((panel) => (
          <span
            key={panel.stepId}
            className={`w-1.5 rounded-full transition-[height,background-color] duration-200 ${
              panel.isActive ? "h-10 bg-brand-accent" : "h-4 bg-white/20"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export function WorkflowSceneFallback() {
  const t = useTranslations("Index.Workflow");

  return (
    <div className="relative flex h-full min-h-[640px] overflow-hidden bg-black">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -right-[18%] -top-[16%] h-[78%] w-[70%] rounded-full bg-[radial-gradient(circle,rgba(34,20,255,0.46)_0%,rgba(34,20,255,0.12)_48%,transparent_72%)] blur-2xl" />
        <div className="absolute -bottom-[30%] right-[8%] h-[72%] w-[58%] rounded-full bg-[radial-gradient(circle,rgba(255,0,144,0.34)_0%,rgba(255,0,144,0.08)_52%,transparent_74%)] blur-2xl" />
      </div>

      <div className="relative z-10 flex min-h-[360px] w-full max-w-[760px] flex-col justify-center px-7 pb-4 pt-10 sm:px-12 sm:py-12 lg:min-h-0 lg:px-14">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-accent sm:text-xs">
          {t("telegram.eyebrow")}
        </p>
        <h1
          className={`${unbounded.className} mt-4 max-w-[590px] whitespace-pre-line text-[clamp(1.85rem,3.65vw,3.4rem)] font-extrabold leading-[0.98] tracking-[-0.065em] text-white sm:mt-5 lg:mt-6`}
        >
          {t("telegram.title")}
        </h1>
        <p className="mt-4 max-w-[540px] text-sm font-medium leading-5 text-zinc-400 sm:mt-5 sm:text-base sm:leading-6 lg:mt-6 lg:text-lg lg:leading-7">
          {t("telegram.description")}
        </p>
        <HomePrimaryActions compact className="relative z-20 mt-3 lg:mt-5" />
      </div>
    </div>
  );
}

export function WorkflowStaticSummary() {
  const t = useTranslations("Index.Workflow");
  const steps = [
    {
      description: t("telegram.description"),
      eyebrow: t("telegram.eyebrow"),
      title: t("telegram.title"),
    },
    {
      description: t("post.description"),
      eyebrow: t("post.eyebrow"),
      title: t("post.title"),
    },
    {
      description: t("contract.description"),
      eyebrow: t("contract.eyebrow"),
      title: t("contract.title"),
    },
    {
      description: t("share.staticDescription"),
      eyebrow: t("share.eyebrow"),
      title: `${t("share.title")}\n${t("share.lineStatic")}`,
    },
    {
      description: t("reputation.description"),
      eyebrow: t("reputation.eyebrow"),
      title: t("reputation.lineFinal"),
    },
  ];

  return (
    <ol className="grid gap-px overflow-hidden rounded-[2.75rem] border border-white/15 bg-white/15 md:grid-cols-2 xl:grid-cols-5">
      {steps.map((step, index) => {
        const Heading = index === 0 ? "h1" : "h2";

        return (
          <li
            key={step.eyebrow}
            className="min-h-64 bg-[#070707] p-7 sm:p-9"
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-accent">
              {step.eyebrow}
            </p>
            <Heading
              className={`${unbounded.className} mt-5 whitespace-pre-line text-2xl font-extrabold leading-[1.02] tracking-[-0.055em] text-white`}
            >
              {step.title}
            </Heading>
            <p className="mt-5 text-sm font-medium leading-6 text-zinc-400">
              {step.description}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
