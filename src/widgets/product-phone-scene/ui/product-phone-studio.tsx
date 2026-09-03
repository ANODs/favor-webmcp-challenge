"use client";

import { Environment } from "@react-three/drei";

export type ProductPhoneStudioProps = {
  accentColor: string;
};

export function ProductPhoneStudio({
  accentColor,
}: ProductPhoneStudioProps) {
  return (
    <>
      <Environment resolution={64} frames={1} environmentIntensity={1.15}>
        <mesh position={[0, 4, -3]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[11, 7]} />
          <meshBasicMaterial color="#f7f8ff" />
        </mesh>
        <mesh position={[-5, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[8, 9]} />
          <meshBasicMaterial color="#2541ff" />
        </mesh>
        <mesh position={[5, -1.5, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <planeGeometry args={[7, 9]} />
          <meshBasicMaterial color="#ff3cac" />
        </mesh>
        <mesh position={[0, 0, -5]}>
          <planeGeometry args={[14, 10]} />
          <meshBasicMaterial color="#07080d" />
        </mesh>
      </Environment>

      <ambientLight intensity={0.42} />
      <rectAreaLight
        position={[4.8, 5.8, 5]}
        rotation={[-0.45, 0.55, 0.1]}
        width={3.2}
        height={6}
        intensity={8}
        color="#ffffff"
      />
      <spotLight
        position={[-5.5, 3.2, 5]}
        angle={0.48}
        penumbra={0.85}
        intensity={55}
        distance={24}
        color="#3046ff"
      />
      <pointLight
        position={[4.2, -2.5, 3.5]}
        intensity={48}
        distance={16}
        decay={2}
        color="#ff3cac"
      />
      <pointLight
        position={[3.8, 1.5, 4]}
        intensity={20}
        distance={10}
        decay={2}
        color={accentColor}
      />
    </>
  );
}
