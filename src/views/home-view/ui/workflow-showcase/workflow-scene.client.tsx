"use client";

import { PerspectiveCamera } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useMotionValueEvent, type MotionValue } from "framer-motion";
import { useLocale, useMessages } from "next-intl";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import * as THREE from "three";

import {
  ProductPhoneModel,
  ProductPhoneStudio,
} from "@/widgets/product-phone-scene";

import { HomeGrainientBackground } from "../home-grainient-background";
import { formatTelegramPhoneTime } from "../telegram-phone-status-bar";
import { deriveWorkflowFrame } from "./model/timeline";
import type { WorkflowFrame } from "./model/types";
import { WorkflowCopyPanels } from "./workflow-copy-panels";
import {
  useWorkflowScreenTexture,
  type WorkflowScreenTextureController,
} from "./workflow-screen-texture";

type Props = {
  captureMode: boolean;
  onReady?: () => void;
  progress: MotionValue<number>;
};

export function WorkflowScene({ captureMode, onReady, progress }: Props) {
  const locale = useLocale() === "en" ? "en" : "ru";
  const messages = useMessages();
  const [initialCanvasReady, setInitialCanvasReady] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);
  const didNotifyReadyRef = useRef(false);
  const markInitialCanvasReady = useCallback(() => {
    setInitialCanvasReady(true);
    if (didNotifyReadyRef.current) return;

    didNotifyReadyRef.current = true;
    onReady?.();
  }, [onReady]);
  const markCanvasReady = useCallback(() => setCanvasReady(true), []);
  const [frame, setFrame] = useState<WorkflowFrame>(() =>
    deriveWorkflowFrame(progress.get()),
  );
  const screenTexture = useWorkflowScreenTexture({
    locale,
    messages,
  });

  useMotionValueEvent(progress, "change", (value) => {
    setFrame(deriveWorkflowFrame(value));
  });

  return (
    <div
      className="relative h-full overflow-hidden bg-[#050505]"
      data-workflow-initial-ready={initialCanvasReady ? "true" : undefined}
      data-workflow-scene-ready={canvasReady ? "true" : undefined}
      data-workflow-phase={frame.phaseKind}
      data-workflow-stage={
        frame.screen.blend >= 0.5
          ? frame.screen.toStageId
          : frame.screen.fromStageId
      }
      data-workflow-transition={
        frame.screen.fromStageId !== frame.screen.toStageId
          ? `${frame.screen.fromStageId}:${frame.screen.toStageId}`
          : undefined
      }
      data-workflow-blend={frame.screen.blend.toFixed(3)}
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <HomeGrainientBackground />
      </div>
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(5,5,5,1)_0%,rgba(5,5,5,0.98)_37%,rgba(5,5,5,0.66)_54%,rgba(5,5,5,0.05)_100%)]"
        aria-hidden="true"
      />

      <div className="relative z-10 grid h-full lg:grid-cols-[minmax(0,0.82fr)_minmax(440px,1.18fr)]">
        <WorkflowCopyPanels
          animateTransitions={!captureMode}
          frame={frame}
        />

        <div
          className="absolute inset-x-0 bottom-[4.5%] h-[58%] sm:bottom-[-10%] sm:h-[68%] lg:relative lg:inset-auto lg:h-full lg:min-h-0"
          aria-hidden="true"
        >
          <Canvas
            camera={{ position: [0, 0.05, 12.4], fov: 36, near: 0.1, far: 50 }}
            dpr={captureMode ? 1 : [1, 1.5]}
            frameloop="demand"
            gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
            onCreated={({ gl }) => {
              gl.outputColorSpace = THREE.SRGBColorSpace;
              gl.toneMapping = THREE.ACESFilmicToneMapping;
              gl.toneMappingExposure = 1.12;
            }}
          >
            <WorkflowPhoneRig
              locale={locale}
              progress={progress}
              screenTexture={screenTexture}
            />
            {screenTexture.initialReady ? (
              <SceneReadySignal
                key="initial"
                onReady={markInitialCanvasReady}
              />
            ) : null}
            {screenTexture.ready ? (
              <SceneReadySignal key="complete" onReady={markCanvasReady} />
            ) : null}
          </Canvas>
        </div>
      </div>

      {screenTexture.sourcePortal}
    </div>
  );
}

function SceneReadySignal({ onReady }: { onReady: () => void }) {
  const didSignal = useRef(false);

  useFrame(() => {
    if (didSignal.current) return;

    didSignal.current = true;
    requestAnimationFrame(onReady);
  });

  return null;
}

function WorkflowPhoneRig({
  locale,
  progress,
  screenTexture,
}: {
  locale: "ru" | "en";
  progress: MotionValue<number>;
  screenTexture: WorkflowScreenTextureController;
}) {
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const phoneRef = useRef<THREE.Group>(null);
  const { invalidate } = useThree();
  const drawScreen = screenTexture.draw;
  const screenReady = screenTexture.initialReady;
  const screenRevision = screenTexture.revision;

  useEffect(() => progress.on("change", () => invalidate()), [invalidate, progress]);

  useEffect(() => {
    if (!screenReady) return;

    const drawCurrentFrame = () => {
      drawScreen(
        deriveWorkflowFrame(progress.get()).screen,
        formatTelegramPhoneTime(new Date(), locale),
      );
      invalidate();
    };

    drawCurrentFrame();
    const animationFrameId = requestAnimationFrame(drawCurrentFrame);
    return () => cancelAnimationFrame(animationFrameId);
  }, [
    drawScreen,
    invalidate,
    locale,
    progress,
    screenReady,
    screenRevision,
  ]);

  useEffect(() => {
    let timeoutId = 0;

    const scheduleNextMinute = () => {
      const delay = 60_000 - (Date.now() % 60_000) + 50;
      timeoutId = window.setTimeout(() => {
        invalidate();
        scheduleNextMinute();
      }, delay);
    };

    scheduleNextMinute();
    return () => window.clearTimeout(timeoutId);
  }, [invalidate]);

  useFrame(() => {
    const frame = deriveWorkflowFrame(progress.get());
    const camera = cameraRef.current;
    const phone = phoneRef.current;
    if (!camera || !phone) return;

    drawScreen(
      frame.screen,
      formatTelegramPhoneTime(new Date(), locale),
    );

    camera.position.set(...frame.camera.position);
    camera.fov = frame.camera.fov;
    camera.updateProjectionMatrix();
    camera.lookAt(...frame.camera.target);

    phone.position.set(...frame.phone.position);
    phone.rotation.set(
      THREE.MathUtils.degToRad(frame.phone.rotation[0]),
      THREE.MathUtils.degToRad(frame.phone.rotation[1]),
      THREE.MathUtils.degToRad(frame.phone.rotation[2]),
      "XYZ",
    );
    phone.scale.setScalar(frame.phone.scale);
    phone.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
  }, -1);

  return (
    <>
      <PerspectiveCamera
        ref={cameraRef}
        makeDefault
        position={[0, 0.05, 12.4]}
        fov={36}
        near={0.1}
        far={50}
      />
      <ProductPhoneStudio accentColor="#75F760" />
      <ProductPhoneModel
        modelRef={phoneRef}
        screenTexture={screenTexture.texture}
      />
    </>
  );
}
