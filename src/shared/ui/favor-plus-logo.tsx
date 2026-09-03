"use client";

import { useId } from "react";
import { cn } from "@/shared/lib/cn";

type Props = {
  className?: string;
  size?: number;
  fill?: string;
};

export function FavorPlusLogo({ className, size = 28, fill = "var(--color-brand-accent)" }: Props) {
  const id = useId();
  // Sanitize the React 18 useId() which contains colons that can break SVG url() references in CSS selectors in some browsers.
  const maskId = `favor-plus-mask-${id.replace(/:/g, "")}`;

  return (
    <svg
      className={cn("shrink-0 drop-shadow-[0_0_8px_var(--color-brand-accent)]", className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <mask id={maskId}>
          {/* Base white background to preserve the cross */}
          <rect width="24" height="24" fill="white" />
          {/* Black star cutout in the center */}
          <path d="M12 6Q12 12 18 12Q12 12 12 18Q12 12 6 12Q12 12 12 6Z" fill="black" />
        </mask>
      </defs>

      {/* Main Cross Body with Mask Applied */}
      <g mask={`url(#${maskId})`}>
        {/* Horizontal rounded bar */}
        <rect x="2" y="8" width="20" height="8" rx="2.5" ry="2.5" fill={fill} />
        {/* Vertical rounded bar */}
        <rect x="8" y="2" width="8" height="20" rx="2.5" ry="2.5" fill={fill} />
      </g>
    </svg>
  );
}
