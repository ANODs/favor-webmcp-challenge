"use client";

import { RoundedBox } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import type { ReactNode, Ref } from "react";
import type { Group, Texture } from "three";

const CHROME_COLOR = "#757984";

export const PRODUCT_PHONE_SCREEN = {
  cssHeight: 720,
  cssWidth: 360,
  radius: 32,
  worldHeight: 7.04,
  worldWidth: 3.42,
  z: 0.365,
} as const;

export type ProductPhoneModelProps = {
  children?: ReactNode;
  modelRef?: Ref<Group>;
  onScreenClick?: (event: ThreeEvent<MouseEvent>) => void;
  rotation?: [number, number, number];
  screenTexture?: Texture;
};

export function ProductPhoneModel({
  children,
  modelRef,
  onScreenClick,
  rotation,
  screenTexture,
}: ProductPhoneModelProps) {
  return (
    <group ref={modelRef} rotation={rotation}>
      <RoundedBox args={[3.78, 7.62, 0.62]} radius={0.4} smoothness={10}>
        <meshPhysicalMaterial
          color={CHROME_COLOR}
          metalness={1}
          roughness={0.12}
          clearcoat={1}
          clearcoatRoughness={0.04}
          envMapIntensity={2.4}
        />
      </RoundedBox>

      <RoundedBox
        args={[3.64, 7.48, 0.54]}
        radius={0.35}
        smoothness={10}
        position={[0, 0, 0.06]}
      >
        <meshPhysicalMaterial
          color="#08090d"
          metalness={0.68}
          roughness={0.18}
          envMapIntensity={1.65}
        />
      </RoundedBox>

      <group position={[0, 0, PRODUCT_PHONE_SCREEN.z]}>
        <mesh name="product-phone-screen-surface" onClick={onScreenClick}>
          <planeGeometry
            args={[
              PRODUCT_PHONE_SCREEN.worldWidth,
              PRODUCT_PHONE_SCREEN.worldHeight,
            ]}
          />
          <meshBasicMaterial
            color={screenTexture ? "#ffffff" : "#050507"}
            map={screenTexture ?? null}
            transparent
            alphaTest={0.02}
            toneMapped={false}
          />
        </mesh>

        {children}
      </group>

      <SideButton position={[1.91, 0.92, 0.08]} height={1.02} />
      <SideButton position={[-1.91, 1.55, 0.08]} height={0.28} />
      <SideButton position={[-1.91, 0.88, 0.08]} height={0.52} />
      <SideButton position={[-1.91, 0.2, 0.08]} height={0.52} />
    </group>
  );
}

function SideButton({
  height,
  position,
}: {
  height: number;
  position: [number, number, number];
}) {
  return (
    <RoundedBox
      args={[0.065, height, 0.16]}
      radius={0.03}
      smoothness={6}
      position={position}
    >
      <meshPhysicalMaterial
        color={CHROME_COLOR}
        metalness={1}
        roughness={0.12}
        clearcoat={1}
        clearcoatRoughness={0.04}
        envMapIntensity={2.4}
      />
    </RoundedBox>
  );
}
