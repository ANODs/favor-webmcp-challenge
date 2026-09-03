"use client";

import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { useLocale, useTranslations } from "next-intl";
import {
  useCallback,
  useRef,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import * as THREE from "three";

import {
  ProductPhoneModel,
  ProductPhoneStudio,
} from "@/widgets/product-phone-scene";

import { HOME_SECTION_IDS } from "./home-section-ids";
import {
  TELEGRAM_SCREEN_CONTRACT_BUTTON,
  type TelegramScreenCopy,
  useTelegramScreenTexture,
} from "./telegram-screen-texture";

const AUTO_ROTATION_AMPLITUDE = THREE.MathUtils.degToRad(5);
const AUTO_ROTATION_SPEED = 0.72;
const BASE_ROTATION = {
  x: THREE.MathUtils.degToRad(1.8),
  y: THREE.MathUtils.degToRad(-7),
  z: THREE.MathUtils.degToRad(-4.3),
};

type RotationTarget = {
  x: number;
  y: number;
};

export function HeroPhoneScene({ onReady }: { onReady?: () => void }) {
  const locale = useLocale();
  const t = useTranslations("Index.TelegramMockup");
  const autoRotationEnabled = useRef(true);
  const dragOrigin = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const didDrag = useRef(false);
  const rotationTarget = useRef<RotationTarget>({ x: BASE_ROTATION.x, y: BASE_ROTATION.y });
  const screenCopy: TelegramScreenCopy = {
    clientName: t("clientName"),
    lastSeen: t("lastSeen"),
    message1: t("message1"),
    message2: t("message2"),
    contractTitle: t("contractTitle"),
    category: t("category"),
    budget: t("budget"),
    deadline: t("deadline"),
    published: t("published"),
    openContract: t("openContract"),
    inputPlaceholder: t("inputPlaceholder"),
  };
  const accentColor = getComputedStyle(document.documentElement)
    .getPropertyValue("--color-brand-accent")
    .trim();
  const didSignalReady = useRef(false);

  const handleSceneReady = useCallback(() => {
    if (didSignalReady.current) return;

    didSignalReady.current = true;
    onReady?.();
  }, [onReady]);

  const resetTilt = () => {
    autoRotationEnabled.current = true;
    dragOrigin.current = null;
    rotationTarget.current = { x: BASE_ROTATION.x, y: BASE_ROTATION.y };
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    autoRotationEnabled.current = false;
    didDrag.current = false;
    dragOrigin.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic QA events do not always create a capturable browser pointer.
    }
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const origin = dragOrigin.current;
    if (!origin || origin.pointerId !== event.pointerId) return;

    if (Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 5) {
      didDrag.current = true;
    }

    const dragRotationY = THREE.MathUtils.degToRad(
      THREE.MathUtils.clamp((event.clientX - origin.x) * 0.045, -8, 8),
    );
    const dragRotationX = THREE.MathUtils.degToRad(
      THREE.MathUtils.clamp((origin.y - event.clientY) * 0.04, -6, 6),
    );
    rotationTarget.current = {
      x: BASE_ROTATION.x + dragRotationX,
      y: BASE_ROTATION.y + dragRotationY,
    };
  };

  const handlePointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    resetTilt();
  };

  const openPopularContracts = () => {
    if (didDrag.current) return;

    document.getElementById(HOME_SECTION_IDS.popularContracts)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <div
      className="relative h-[600px] w-full sm:h-[720px]"
      aria-label={`${screenCopy.contractTitle} — Favor`}
    >
      <div className="hero-phone-scene-float absolute inset-0">
        <div
          data-phone-interaction
          className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          onLostPointerCapture={resetTilt}
        >
          <Canvas
            camera={{ position: [0, 0, 12.4], fov: 36, near: 0.1, far: 50 }}
            dpr={[1, 1.75]}
            gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
            onCreated={({ gl }) => {
              gl.outputColorSpace = THREE.SRGBColorSpace;
              gl.toneMapping = THREE.ACESFilmicToneMapping;
              gl.toneMappingExposure = 1.12;
            }}
          >
            <ProductPhoneStudio accentColor={accentColor} />
            <PhoneModel
              accentColor={accentColor}
              autoRotationEnabled={autoRotationEnabled}
              locale={locale}
              onOpenContract={openPopularContracts}
              onReady={handleSceneReady}
              rotationTarget={rotationTarget}
              screenCopy={screenCopy}
            />
          </Canvas>
        </div>
        <button
          type="button"
          className="sr-only focus:not-sr-only focus:absolute focus:bottom-4 focus:right-4 focus:z-20 focus:rounded-full focus:bg-[var(--color-brand-accent)] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-black focus:outline-none focus:ring-2 focus:ring-white"
          onClick={openPopularContracts}
        >
          {screenCopy.openContract}
        </button>
      </div>
    </div>
  );
}

function PhoneModel({
  accentColor,
  autoRotationEnabled,
  locale,
  onOpenContract,
  onReady,
  rotationTarget,
  screenCopy,
}: {
  accentColor: string;
  autoRotationEnabled: RefObject<boolean>;
  locale: string;
  onOpenContract: () => void;
  onReady: () => void;
  rotationTarget: RefObject<RotationTarget>;
  screenCopy: TelegramScreenCopy;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const screenTexture = useTelegramScreenTexture({ accentColor, copy: screenCopy, locale });

  const handleScreenClick = (event: ThreeEvent<MouseEvent>) => {
    const uv = event.uv;
    if (!uv) return;

    const textureX = uv.x * 360;
    const textureY = (1 - uv.y) * 720;
    const contractButton = TELEGRAM_SCREEN_CONTRACT_BUTTON;
    const isContractButton =
      textureX >= contractButton.x &&
      textureX <= contractButton.x + contractButton.width &&
      textureY >= contractButton.y &&
      textureY <= contractButton.y + contractButton.height;

    if (!isContractButton) return;

    event.stopPropagation();
    onOpenContract();
  };

  useFrame((state, delta) => {
    const group = groupRef.current;
    const target = rotationTarget.current;
    if (!group || !target) return;

    const automaticRotationY = autoRotationEnabled.current
      ? Math.sin(state.clock.elapsedTime * AUTO_ROTATION_SPEED) * AUTO_ROTATION_AMPLITUDE
      : 0;

    group.rotation.x = THREE.MathUtils.damp(group.rotation.x, target.x, 7, delta);
    group.rotation.y = THREE.MathUtils.damp(
      group.rotation.y,
      target.y + automaticRotationY,
      7,
      delta,
    );
  });

  return (
    <>
      <ProductPhoneModel
        modelRef={groupRef}
        onScreenClick={handleScreenClick}
        rotation={[BASE_ROTATION.x, BASE_ROTATION.y, BASE_ROTATION.z]}
        screenTexture={screenTexture.texture}
      />
      <HeroSceneReadySignal ready={screenTexture.ready} onReady={onReady} />
    </>
  );
}

function HeroSceneReadySignal({ ready, onReady }: { ready: boolean; onReady: () => void }) {
  const renderedFrameCount = useRef(0);
  const didSignal = useRef(false);

  useFrame(() => {
    if (!ready || didSignal.current) return;

    renderedFrameCount.current += 1;
    if (renderedFrameCount.current < 2) return;

    didSignal.current = true;
    onReady();
  });

  return null;
}
