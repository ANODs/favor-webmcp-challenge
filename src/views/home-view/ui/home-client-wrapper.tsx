"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useTranslations } from "next-intl";

import {
  TelegramInitAuthRedirect,
  type AuthStatus,
} from "@/shared/ui/telegram-init-auth-redirect";

import { Preloader } from "./preloader";
import { HeroSection } from "./hero-section";
import { WorkflowShowcaseSection } from "./workflow-showcase/workflow-showcase-section";

const WORKFLOW_READY_TIMEOUT_MS = 3_000;
const subscribeToCaptureMode = () => () => undefined;
const getCaptureModeSnapshot = () =>
  new URLSearchParams(window.location.search).get("workflowCapture") === "1";
const getServerCaptureModeSnapshot = () => false;

type IntroMode = "workflow" | "hero";

export function HomeClientWrapper({ children }: { children: React.ReactNode }) {
  const heroT = useTranslations("Index.Hero");
  const workflowT = useTranslations("Index.Workflow");
  const [authStatus, setAuthStatus] = useState<AuthStatus>("pending");
  const [introMode, setIntroMode] = useState<IntroMode>("workflow");
  const [introReady, setIntroReady] = useState(false);
  const introResolvedRef = useRef(false);
  const captureMode = useSyncExternalStore(
    subscribeToCaptureMode,
    getCaptureModeSnapshot,
    getServerCaptureModeSnapshot,
  );
  const showPreloader = authStatus !== "done" || !introReady;

  useEffect(() => {
    if (captureMode || introReady || introMode !== "workflow") return;

    const timer = window.setTimeout(() => {
      if (introResolvedRef.current) return;

      introResolvedRef.current = true;
      setIntroMode("hero");
      setIntroReady(true);
    }, WORKFLOW_READY_TIMEOUT_MS);

    return () => window.clearTimeout(timer);
  }, [captureMode, introMode, introReady]);

  useEffect(() => {
    if (!showPreloader) return;

    const root = document.documentElement;
    const body = document.body;
    const previousRootOverflow = root.style.overflow;
    const previousBodyOverflow = body.style.overflow;
    root.style.overflow = "hidden";
    body.style.overflow = "hidden";

    return () => {
      root.style.overflow = previousRootOverflow;
      body.style.overflow = previousBodyOverflow;
    };
  }, [showPreloader]);

  const handleAuthStatusChange = useCallback((nextStatus: AuthStatus) => {
    setAuthStatus(nextStatus);
  }, []);

  const handleWorkflowReady = useCallback(() => {
    if (introResolvedRef.current) return;

    introResolvedRef.current = true;
    setIntroReady(true);
  }, []);

  const handleWorkflowUnavailable = useCallback(() => {
    if (introResolvedRef.current) return;

    introResolvedRef.current = true;
    setIntroMode("hero");
    setIntroReady(true);
  }, []);

  const semanticSteps = [
    [workflowT("telegram.title"), workflowT("telegram.description")],
    [workflowT("post.title"), workflowT("post.description")],
    [workflowT("contract.title"), workflowT("contract.description")],
    [
      `${workflowT("share.title")} ${workflowT("share.lineStatic")}`,
      workflowT("share.staticDescription"),
    ],
    [workflowT("reputation.lineFinal"), workflowT("reputation.description")],
  ] as const;

  return (
    <>
      <Preloader
        isVisible={showPreloader}
        label={workflowT("loadingLabel")}
      />
      <TelegramInitAuthRedirect onStatusChange={handleAuthStatusChange} />

      <div className="flex w-full flex-col gap-16 sm:gap-24">
        <div
          id="favor-workflow"
          data-home-intro-mode={introMode}
          data-home-intro-ready={introReady ? "true" : "false"}
        >
          <header className="sr-only" aria-hidden="true">
            <p>{heroT("title")}</p>
            <p>{heroT("description")}</p>
            <h2>{workflowT("ariaLabel")}</h2>
            <ol>
              {semanticSteps.map(([title, description]) => (
                <li key={title}>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </li>
              ))}
            </ol>
          </header>

          {introMode === "workflow" ? (
            <WorkflowShowcaseSection
              primary
              onReady={handleWorkflowReady}
              onUnavailable={handleWorkflowUnavailable}
            />
          ) : (
            <HeroSection />
          )}
        </div>
        {children}
      </div>
    </>
  );
}
