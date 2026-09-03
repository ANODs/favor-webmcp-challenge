"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Environment, useGLTF, PresentationControls } from "@react-three/drei";
import { Suspense, useRef, useEffect, useMemo } from "react";
import * as THREE from "three";
import { EffectComposer, Bloom } from "@react-three/postprocessing";

function TelegramModel() {
  const { scene } = useGLTF("/glb/telegram_3d-icon.glb");
  const sceneBack = useMemo(() => scene.clone(true), [scene]);
  const ref = useRef<THREE.Group>(null);

  // Apply brand-blue color to the model materials
  useEffect(() => {
    [scene, sceneBack].forEach((s) => {
      s.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          if (mesh.material instanceof THREE.MeshStandardMaterial || mesh.material instanceof THREE.MeshPhysicalMaterial) {
            const mat = mesh.material.clone() as THREE.MeshStandardMaterial;
            mat.color.set("#0B0FB4");
            // Emissive helps the bloom effect pop
            mat.emissive.set("#0B0FB4");
            mat.emissiveIntensity = 0.4;
            mesh.material = mat;
          }
        }
      });
    });
  }, [scene, sceneBack]);

  // Continuous slow rotation on the Y axis
  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.elapsedTime * 0.25;
    }
  });

  return (
    <Float
      speed={2}
      rotationIntensity={0.2}
      floatIntensity={1}
      floatingRange={[-0.1, 0.1]}
    >
      <group ref={ref} scale={1}>
        <primitive object={scene} position={[0, 0, 0.06]} />
        <primitive object={sceneBack} position={[0, 0, -0.06]} rotation={[0, Math.PI, 0]} />
      </group>
    </Float>
  );
}

export function Telegram3DScene() {
  return (
    <div className="absolute -inset-12 z-10 cursor-grab active:cursor-grabbing filter brightness-[1.5] hue-rotate-[-60deg] dark:brightness-100 dark:hue-rotate-0">
      <Canvas camera={{ position: [0, 0, 4.5], fov: 60 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
        <Suspense fallback={null}>
          <ambientLight intensity={1.5} />
          <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={2} castShadow />
          <pointLight position={[-10, -10, -10]} intensity={1} />
          <Environment preset="city" />
          <PresentationControls
            global
            rotation={[Math.PI / 6, 0, 0]}
            polar={[-Math.PI / 6, Math.PI / 6]}
            azimuth={[-Math.PI / 4, Math.PI / 4]}
            snap={true}
          >
            <TelegramModel />
          </PresentationControls>
          <EffectComposer>
            <Bloom luminanceThreshold={0.1} mipmapBlur intensity={1.5} />
          </EffectComposer>
        </Suspense>
      </Canvas>
    </div>
  );
}

// Preload the model for performance
useGLTF.preload("/glb/telegram_3d-icon.glb");
