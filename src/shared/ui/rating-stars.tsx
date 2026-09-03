type Props = {
  value?: number | null;
  size?: "sm" | "md";
  variant?: "full" | "compact";
  emptyLabel?: string;
  showValue?: boolean;
  onChange?: (value: number) => void;
  interactive?: boolean;
};

const starSizeClassNames = {
  sm: "h-3.5 w-3.5",
  md: "h-4.5 w-4.5",
} as const;

const textSizeClassNames = {
  sm: "text-xs",
  md: "text-sm",
} as const;

export function RatingStars({
  value,
  size = "md",
  variant = "full",
  emptyLabel = "—",
  showValue = true,
  onChange,
  interactive = false,
}: Props) {
  if ((value === null || value === undefined) && !interactive) {
    return <span className="text-sm text-zinc-500">{emptyLabel}</span>;
  }

  const normalizedValue = value === null || value === undefined ? 0 : Math.max(0, Math.min(5, value));
  const isCompact = variant === "compact" && !interactive;
  const starCount = isCompact ? 1 : 5;

  return (
    <div className="flex min-w-0 flex-nowrap items-center gap-2">
      <div className={`flex items-center gap-1 ${interactive ? "cursor-pointer" : ""}`}>
        {Array.from({ length: starCount }, (_, index) => {
          const fill = isCompact
            ? normalizedValue > 0
              ? 1
              : 0
            : Math.max(0, Math.min(1, normalizedValue - index));

          return (
            <RatingStar
              key={index}
              fill={fill}
              size={size}
              interactive={interactive}
              onClick={interactive && onChange ? () => onChange(index + 1) : undefined}
              label={`${index + 1} / 5`}
            />
          );
        })}
      </div>
      {showValue && value !== null && value !== undefined && value > 0 ? (
        <span className={`font-medium text-zinc-900 ${textSizeClassNames[size]}`}>
          {normalizedValue.toFixed(1)}
        </span>
      ) : null}
    </div>
  );
}

function RatingStar({
  fill,
  size,
  interactive,
  onClick,
  label,
}: {
  fill: number;
  size: Props["size"];
  interactive?: boolean;
  onClick?: () => void;
  label: string;
}) {
  const width = `${fill * 100}%`;
  const className = `relative inline-block shrink-0 rounded-sm ${starSizeClassNames[size ?? "md"]}`;
  const content = (
    <>
      <RatingStarIcon className="h-full w-full text-zinc-200 dark:text-white/15" />
      <span className="absolute inset-0 overflow-hidden" style={{ width }}>
        <RatingStarIcon
          className={`${starSizeClassNames[size ?? "md"]} max-w-none text-[#0f8c5c] dark:text-brand-accent`}
        />
      </span>
    </>
  );

  if (!interactive) {
    return (
      <span aria-hidden="true" className={className}>
        {content}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`${className} transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8c5c] focus-visible:ring-offset-1 dark:focus-visible:ring-brand-accent`}
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      {content}
    </button>
  );
}

function RatingStarIcon({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.285 3.954a1 1 0 00.95.69h4.158c.969 0 1.371 1.24.588 1.81l-3.364 2.445a1 1 0 00-.364 1.118l1.285 3.954c.3.921-.755 1.688-1.539 1.118l-3.364-2.445a1 1 0 00-1.176 0l-3.364 2.445c-.783.57-1.838-.197-1.539-1.118l1.285-3.954a1 1 0 00-.364-1.118L2.07 9.38c-.783-.57-.38-1.81.588-1.81h4.158a1 1 0 00.95-.69l1.285-3.954z" />
    </svg>
  );
}
