import { getContractGradientStyle } from "../model/visual";

type Props = {
  seed: string;
  alt: string;
  className?: string;
  imageClassName?: string;
};

export function ContractGradientArtwork({ seed, alt, className, imageClassName }: Props) {
  return (
    <div
      role="img"
      aria-label={alt}
      className={className ?? "block w-full overflow-hidden rounded-3xl"}
    >
      <div
        className={`relative h-full min-h-40 w-full overflow-hidden ${imageClassName ?? ""}`}
        style={getContractGradientStyle(seed)}
      >
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.24),transparent_36%,rgba(0,0,0,0.28))]" />
        <div className="absolute -right-[18%] -top-[24%] aspect-square w-[72%] rounded-full border border-white/20 bg-white/10 shadow-[inset_0_0_70px_rgba(255,255,255,0.16),0_30px_90px_rgba(0,0,0,0.35)] backdrop-blur-2xl" />
        <div className="absolute bottom-[10%] left-[10%] h-[18%] w-[44%] rounded-full bg-white/15 blur-2xl" />
        <div className="absolute bottom-4 left-4 flex h-10 w-10 items-center justify-center rounded-2xl border border-white/25 bg-black/20 text-lg font-black text-white/90 shadow-lg backdrop-blur-md">
          F
        </div>
      </div>
    </div>
  );
}
