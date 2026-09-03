import { useId, type ReactNode } from "react";
import { Unbounded } from "next/font/google";

const unbounded = Unbounded({ subsets: ["latin", "cyrillic"] });

type BadgePillProps = {
  icon?: ReactNode;
  label: ReactNode;
  title?: string;
  tone?: "brand-accent" | "brand-blue" | "brand-pink" | "default";
  className?: string;
  tooltipFocusable?: boolean;
};

export function BadgePill({
  icon,
  label,
  title,
  tone = "brand-accent",
  className = "",
  tooltipFocusable = true,
}: BadgePillProps) {
  const tooltipId = useId();
  const hasTooltip = Boolean(title?.trim());
  const toneClassName = {
    "brand-accent": "border-brand-accent/20 bg-brand-accent/5 text-brand-accent-ink dark:text-brand-accent",
    "brand-blue": "border-brand-blue/20 bg-brand-blue/5 text-brand-blue dark:text-blue-400",
    "brand-pink": "border-brand-pink/20 bg-brand-pink/5 text-brand-pink",
    "default": "border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400",
  } satisfies Record<NonNullable<BadgePillProps["tone"]>, string>;

  return (
    <span
      aria-describedby={hasTooltip ? tooltipId : undefined}
      tabIndex={hasTooltip && tooltipFocusable ? 0 : undefined}
      title={title}
      className={`group/badge-tooltip inline-flex min-w-0 max-w-full items-center rounded-full border px-3 py-1 text-[9px] font-black uppercase tracking-wider focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 dark:focus-visible:ring-white ${unbounded.className} ${toneClassName[tone]} ${className}`}
    >
      <span className="relative inline-flex min-w-0 max-w-full items-center gap-1.5">
        {icon && <span className="flex shrink-0 items-center">{icon}</span>}
        <span className="min-w-0 truncate">{label}</span>

        {hasTooltip ? (
          <span
            id={tooltipId}
            role="tooltip"
            className="pointer-events-none absolute top-full left-1/2 z-50 mt-2 w-max max-w-[min(18rem,calc(100vw-2rem))] -translate-x-1/2 translate-y-1 rounded-xl bg-zinc-950 px-3 py-2 text-center text-xs leading-5 font-medium tracking-normal text-pretty normal-case opacity-0 shadow-xl transition duration-150 group-hover/badge-tooltip:translate-y-0 group-hover/badge-tooltip:opacity-100 group-focus-within/badge-tooltip:translate-y-0 group-focus-within/badge-tooltip:opacity-100 dark:bg-white dark:text-zinc-950"
          >
            {title}
          </span>
        ) : null}
      </span>
    </span>
  );
}
