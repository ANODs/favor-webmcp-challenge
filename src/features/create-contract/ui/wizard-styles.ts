export const wizardFieldClassName =
  "w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3.5 text-[15px] font-medium text-zinc-950 outline-none transition placeholder:font-normal placeholder:text-zinc-400 focus:border-brand-accent-ink focus:ring-2 focus:ring-brand-accent-ink/10 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400 dark:border-white/10 dark:focus:!border-brand-accent dark:focus:ring-brand-accent/15";

export const wizardFieldErrorClassName =
  "border-red-300 focus:border-red-500 focus:ring-red-500/10";

export const wizardHelperClassName =
  "text-xs font-normal leading-5 text-zinc-500";

export const wizardErrorClassName =
  "text-xs font-normal leading-5 text-red-700 dark:text-red-400";

export function wizardChoiceClassName(
  isSelected: boolean,
  isDisabled = false,
) {
  return [
    "flex min-h-24 w-full items-start gap-3 rounded-2xl border p-4 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-brand-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] dark:focus-visible:ring-brand-accent",
    isSelected
      ? "border-brand-accent-ink/55 bg-brand-accent/10 text-zinc-950 shadow-[0_8px_24px_rgba(36,160,80,0.08)] ring-1 ring-brand-accent-ink/15 [&>svg]:text-brand-accent-ink dark:border-brand-accent/60 dark:ring-brand-accent/15 dark:[&>svg]:text-brand-accent"
      : "border-zinc-200 bg-white text-zinc-950 hover:border-zinc-400 [&>svg]:text-zinc-400 dark:border-white/10 dark:hover:border-white/20",
    isDisabled ? "cursor-not-allowed opacity-50" : "",
  ].join(" ");
}

export function wizardSegmentedOptionClassName(isSelected: boolean) {
  return isSelected
    ? "bg-brand-accent/15 text-brand-accent-ink shadow-sm ring-1 ring-brand-accent-ink/15 dark:text-brand-accent dark:ring-brand-accent/15"
    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100";
}
