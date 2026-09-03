"use client";

import {
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
} from "framer-motion";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

import { HomePrimaryActions } from "../home-primary-actions";
import {
  WORKFLOW_SECTION_HEIGHT_SVH,
  resolveWorkflowVisualTarget,
} from "./model/timeline";
import {
  WorkflowSceneFallback,
  WorkflowStaticSummary,
} from "./workflow-copy-panels";
import { WorkflowRenderErrorBoundary } from "./workflow-render-error-boundary";

const WorkflowScene = dynamic(
  () => import("./workflow-scene.client").then((module) => module.WorkflowScene),
  {
    ssr: false,
    loading: () => <WorkflowSceneFallback />,
  },
);

type Props = {
  onReady?: () => void;
  onUnavailable?: () => void;
  primary?: boolean;
};

type FavorWorkflowCaptureApi = {
  ready: Promise<void>;
  setProgress: (progress: number) => void;
  whenRendered: () => Promise<void>;
};

declare global {
  interface Window {
    __favorWorkflow?: FavorWorkflowCaptureApi;
  }
}

const afterTwoFrames = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

const CAPTURE_READY_TIMEOUT_MS = 30_000;

const waitForWorkflowScene = async () => {
  const deadline = performance.now() + CAPTURE_READY_TIMEOUT_MS;
  await document.fonts.ready;

  while (!document.querySelector('[data-workflow-scene-ready="true"]')) {
    if (performance.now() >= deadline) {
      throw new Error("Workflow scene did not become ready for capture.");
    }

    await afterTwoFrames();
  }

  await afterTwoFrames();
};

const subscribeToCaptureMode = () => () => undefined;
const getCaptureModeSnapshot = () =>
  new URLSearchParams(window.location.search).get("workflowCapture") === "1";
const getServerCaptureModeSnapshot = () => false;

export function WorkflowShowcaseSection({
  onReady,
  onUnavailable,
  primary = false,
}: Props) {
  const t = useTranslations("Index.Workflow");
  const sectionRef = useRef<HTMLElement>(null);
  const didNotifyReadyRef = useRef(false);
  const onReadyRef = useRef(onReady);
  const onUnavailableRef = useRef(onUnavailable);
  const prefersReducedMotion = useReducedMotion();
  const captureMode = useSyncExternalStore(
    subscribeToCaptureMode,
    getCaptureModeSnapshot,
    getServerCaptureModeSnapshot,
  );
  const captureProgress = useMotionValue(0);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });
  const interactiveTargetProgress = useMotionValue(
    resolveWorkflowVisualTarget(0, false).progress,
  );
  const visualProgress = useSpring(interactiveTargetProgress, {
    stiffness: 28,
    damping: 11,
    mass: 1,
    restDelta: 0.0005,
    restSpeed: 0.0005,
  });

  const notifyReady = useCallback(() => {
    if (didNotifyReadyRef.current) return;

    didNotifyReadyRef.current = true;
    onReadyRef.current?.();
  }, []);

  const notifyUnavailable = useCallback(() => {
    onUnavailableRef.current?.();
  }, []);

  useEffect(() => {
    onReadyRef.current = onReady;
    onUnavailableRef.current = onUnavailable;
  }, [onReady, onUnavailable]);

  useMotionValueEvent(scrollYProgress, "change", (value) => {
    interactiveTargetProgress.set(
      resolveWorkflowVisualTarget(value, false).progress,
    );
  });

  useEffect(() => {
    if (captureMode) return;

    interactiveTargetProgress.set(
      resolveWorkflowVisualTarget(scrollYProgress.get(), false).progress,
    );
  }, [captureMode, interactiveTargetProgress, scrollYProgress]);

  useEffect(() => {
    if (!captureMode) return;

    captureProgress.set(0);
    const ready = waitForWorkflowScene();
    window.__favorWorkflow = {
      ready,
      setProgress: (value) => captureProgress.set(Math.min(1, Math.max(0, value))),
      whenRendered: afterTwoFrames,
    };

    return () => {
      delete window.__favorWorkflow;
    };
  }, [captureMode, captureProgress]);

  const reducedMotion = Boolean(prefersReducedMotion) && !captureMode;
  const progress = captureMode ? captureProgress : visualProgress;

  useEffect(() => {
    if (reducedMotion) notifyReady();
  }, [notifyReady, reducedMotion]);

  if (reducedMotion) {
    return (
      <section
        aria-label={t("ariaLabel")}
        className={`relative ml-[calc(50%_-_50vw)] w-screen bg-black px-3 py-3 sm:px-6 sm:py-6 lg:px-10 ${
          primary ? "-mt-10 sm:-mt-14" : "mt-8 sm:mt-12"
        }`}
      >
        <div className="mx-auto max-w-[1376px]">
          <WorkflowStaticSummary />
          <HomePrimaryActions compact className="mt-4 sm:ml-auto sm:max-w-xl" />
        </div>
      </section>
    );
  }

  return (
    <section
      ref={sectionRef}
      aria-label={t("ariaLabel")}
      data-workflow-capture={captureMode ? "true" : undefined}
      style={
        captureMode
          ? undefined
          : { height: `${WORKFLOW_SECTION_HEIGHT_SVH}svh` }
      }
      className={`relative ml-[calc(50%_-_50vw)] w-screen bg-black px-3 sm:px-6 lg:px-10 ${
        primary ? "-mt-10 sm:-mt-14" : "mt-8 sm:mt-12"
      } ${
        captureMode ? "h-svh min-h-[640px]" : ""
      }`}
    >
      <div
        data-workflow-frame
        className={`mx-auto max-w-[1376px] overflow-hidden rounded-[2.75rem] border border-white/15 bg-black shadow-[0_28px_90px_rgba(0,0,0,0.38)] ${
          captureMode
            ? "relative h-svh min-h-[640px]"
            : "sticky top-[5dvh] h-[90dvh] max-h-[90dvh]"
        }`}
      >
        <WorkflowRenderErrorBoundary
          fallback={<WorkflowSceneFallback />}
          onError={notifyUnavailable}
        >
          <WorkflowScene
            captureMode={captureMode}
            onReady={notifyReady}
            progress={progress}
          />
        </WorkflowRenderErrorBoundary>
      </div>
    </section>
  );
}
