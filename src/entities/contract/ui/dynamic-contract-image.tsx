"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { contractQueryKeys } from "../api/query-keys";
import { contractsClient } from "../api/contracts-client";
import { ImagePreview } from "@/shared/ui";
import { ContractGradientArtwork } from "./contract-gradient-artwork";

type Props = {
  initialMediaRefs?: string[] | null;
  contractSlug: string;
  alt: string;
  className?: string;
  imageClassName?: string;
  multiple?: boolean;
  previewEnabled?: boolean;
};

export function DynamicContractImage({
  initialMediaRefs,
  contractSlug,
  alt,
  className,
  imageClassName,
  multiple = false,
  previewEnabled = true,
}: Props) {
  const t = useTranslations("Contracts");
  const initialImages = initialMediaRefs ?? [];
  const initialImagesKey = initialImages.join("\u0000");
  const [retryState, setRetryState] = useState({ sourceKey: "", count: 0 });
  const [failedSourceKey, setFailedSourceKey] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const { data, refetch } = useQuery({
    queryKey: contractQueryKeys.media(contractSlug),
    queryFn: () => contractsClient.getMedia(contractSlug),
    enabled: false,
  });

  const retryCount = retryState.sourceKey === initialImagesKey ? retryState.count : 0;
  const refreshedImages = retryState.sourceKey === initialImagesKey ? data?.images : undefined;
  const images = failedSourceKey === initialImagesKey ? [] : (refreshedImages ?? initialImages);

  if (images.length === 0) {
    return (
      <ContractGradientArtwork
        seed={contractSlug}
        alt={alt}
        className={className}
        imageClassName={imageClassName}
      />
    );
  }

  const currentIndex = multiple ? Math.min(activeIndex, images.length - 1) : 0;
  const currentImage = images[currentIndex];

  const handleError = () => {
    if (retryCount < 2) {
      setRetryState({ sourceKey: initialImagesKey, count: retryCount + 1 });
      void refetch();
      return;
    }

    setFailedSourceKey(initialImagesKey);
  };

  let url = currentImage;
  if (currentImage.includes("telegram.org") || currentImage.includes("t.me")) {
    url = `/api/telegram/proxy-image?url=${encodeURIComponent(currentImage)}`;
  }
  url = retryCount > 0 ? `${url}${url.includes("?") ? "&" : "?"}retry=${retryCount}` : url;

  const showPrevious = () =>
    setActiveIndex((index) => (index - 1 + images.length) % images.length);
  const showNext = () => setActiveIndex((index) => (index + 1) % images.length);

  return (
    <div
      className="relative h-full w-full"
      onTouchStart={(event) => setTouchStartX(event.touches[0]?.clientX ?? null)}
      onTouchEnd={(event) => {
        if (touchStartX === null || images.length < 2) return;
        const delta = (event.changedTouches[0]?.clientX ?? touchStartX) - touchStartX;
        if (Math.abs(delta) > 45) {
          if (delta > 0) showPrevious();
          else showNext();
        }
        setTouchStartX(null);
      }}
    >
      <ImagePreview
        key={url}
        src={url}
        alt={
          images.length > 1
            ? t("ImageAltWithPosition", {
                alt,
                current: currentIndex + 1,
                total: images.length,
              })
            : alt
        }
        className={className}
        imageClassName={imageClassName}
        onError={handleError}
        previewEnabled={previewEnabled}
      />

      {multiple && images.length > 1 ? (
        <>
          <button
            type="button"
            onClick={showPrevious}
            className="absolute left-3 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-zinc-950/65 text-white shadow-lg backdrop-blur-md transition hover:bg-zinc-950/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            aria-label={t("PreviousImage")}
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={showNext}
            className="absolute right-3 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-zinc-950/65 text-white shadow-lg backdrop-blur-md transition hover:bg-zinc-950/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            aria-label={t("NextImage")}
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
          <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-white/15 bg-zinc-950/65 px-3 py-2 backdrop-blur-md">
            {images.map((image, index) => (
              <button
                key={`${image}-${index}`}
                type="button"
                onClick={() => setActiveIndex(index)}
                className={`h-1.5 rounded-full transition-all ${index === currentIndex ? "w-5 bg-white" : "w-1.5 bg-white/45 hover:bg-white/70"}`}
                aria-label={t("ShowImage", { index: index + 1 })}
                aria-current={index === currentIndex ? "true" : undefined}
              />
            ))}
          </div>
          <span className="absolute bottom-3 right-3 z-10 rounded-full bg-zinc-950/65 px-2.5 py-1.5 text-xs font-semibold text-white backdrop-blur-md">
            {currentIndex + 1}/{images.length}
          </span>
        </>
      ) : null}
    </div>
  );
}
