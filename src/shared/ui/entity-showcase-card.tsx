import type { ReactNode } from "react";
import { Unbounded } from "next/font/google";

import { SurfaceCard } from "./surface-card";

const unbounded = Unbounded({ subsets: ["latin", "cyrillic"] });

type Props = {
  badges?: ReactNode;
  headerAction?: ReactNode;
  media?: ReactNode;
  eyebrow?: ReactNode;
  title: string;
  titleAs?: "h1" | "h2";
  description?: ReactNode;
  metrics?: ReactNode;
  supplemental?: ReactNode;
  tags?: ReactNode;
  meta?: ReactNode;
  footer?: ReactNode;
  className?: string;
};

export function EntityShowcaseCard({
  badges,
  headerAction,
  media,
  eyebrow,
  title,
  titleAs = "h2",
  description,
  metrics,
  supplemental,
  tags,
  meta,
  footer,
  className = "",
}: Props) {
  const TitleTag = titleAs as "h1" | "h2";

  return (
    <SurfaceCard
      paddingClassName="p-0"
      className={`relative overflow-hidden rounded-[2rem] ${className}`}
    >
      {headerAction ? (
        <div className="absolute right-3 top-3 z-20 flex shrink-0 items-center gap-2 sm:right-5 sm:top-5">
          {headerAction}
        </div>
      ) : null}

      {media ? <div className="overflow-hidden">{media}</div> : null}

      <div className="p-4 sm:p-6">
        {badges ? (
          <div className={`flex flex-wrap items-center gap-2 ${headerAction && !media ? "pr-24" : ""}`}>
            {badges}
          </div>
        ) : null}

        {eyebrow ? (
          <div className={`${badges ? "mt-5" : ""} text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500`}>
            {eyebrow}
          </div>
        ) : null}
        <TitleTag
          className={`${unbounded.className} ${badges || eyebrow ? "mt-3" : ""} text-2xl font-extrabold leading-tight tracking-[-0.04em] text-zinc-950 sm:text-3xl`}
        >
          {title}
        </TitleTag>
        {description ? (
          <div className="mt-4 whitespace-pre-wrap text-sm font-medium leading-7 text-zinc-600 sm:text-[15px]">
            {description}
          </div>
        ) : null}

        {metrics ? <div className="mt-6">{metrics}</div> : null}
        {supplemental ? <div className="mt-4">{supplemental}</div> : null}
        {tags ? <div className="mt-5">{tags}</div> : null}
        {meta ? <div className="mt-6">{meta}</div> : null}
        {footer ? <div className="mt-6">{footer}</div> : null}
      </div>
    </SurfaceCard>
  );
}
