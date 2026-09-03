"use client";

/* eslint-disable @next/next/no-img-element -- Sources can be Telegram URLs resolved at runtime. */

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type Props = {
  src: string;
  alt: string;
  className?: string;
  imageClassName?: string;
  dialogImageClassName?: string;
  onError?: () => void;
  previewEnabled?: boolean;
};

export function ImagePreview({
  src,
  alt,
  className,
  imageClassName,
  dialogImageClassName,
  onError,
  previewEnabled = true,
}: Props) {
  const t = useTranslations("Common");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  if (!previewEnabled) {
    return (
      <div className={className ?? "block w-full overflow-hidden rounded-3xl"}>
        <img
          src={src}
          alt={alt}
          className={imageClassName ?? "h-full w-full object-cover"}
          onError={onError}
        />
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className ?? "block w-full overflow-hidden rounded-3xl"}
      >
        <img
          src={src}
          alt={alt}
          className={imageClassName ?? "h-full w-full object-cover"}
          onError={onError}
        />
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={alt}
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute right-4 top-4 rounded-full bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/20"
          >
            {t("close")}
          </button>
          <img
            src={src}
            alt={alt}
            onClick={(event) => event.stopPropagation()}
            className={
              dialogImageClassName ??
              "max-h-[90vh] w-auto max-w-[min(96vw,1200px)] rounded-3xl object-contain"
            }
          />
        </div>
      ) : null}
    </>
  );
}
