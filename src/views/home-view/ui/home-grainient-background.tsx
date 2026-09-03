import { Grainient } from "@/shared/ui";

export function HomeGrainientBackground() {
  return (
    <Grainient
      color1="#000000"
      color2="#0B0FB4"
      color3="#FF61A7"
      timeSpeed={0.2}
      warpStrength={2.1}
      warpFrequency={2.7}
      warpSpeed={0.55}
      warpAmplitude={24}
      distortionStrength={1.1}
      distortionFrequency={9.5}
      distortionSpeed={0.72}
      distortionCenterX={0.72}
      distortionCenterY={0.86}
      blendAngle={-18}
      blendSoftness={0.08}
      rotationAmount={260}
      noiseScale={3.4}
      grainAmount={0.28}
      grainScale={1.65}
      contrast={1.62}
      centerX={0.06}
      centerY={-0.04}
      zoom={0.78}
      className="h-full w-full"
    />
  );
}
