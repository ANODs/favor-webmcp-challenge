import type { HTMLAttributes, ReactNode } from "react";
import { Info } from "lucide-react";

import { SurfaceCard } from "@/shared/ui/surface-card";
import { Button } from "./button";

type ActionCardProps = {
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
  titleClassName?: string;
};

type ActionTone = "primary" | "secondary";

export const actionCardFieldClassName =
  "w-full rounded-2xl border border-zinc-200 bg-transparent px-4 py-3 text-sm outline-none transition focus:border-zinc-900 disabled:cursor-not-allowed disabled:bg-zinc-100";

export function ActionCard({
  title,
  description,
  children,
  className = "",
  bodyClassName = "mt-5 flex flex-1 flex-col",
  titleClassName = "font-semibold",
}: ActionCardProps) {
  return (
    <SurfaceCard
      className={`flex h-full flex-col rounded-[2rem] shadow-[0_18px_48px_rgba(9,9,11,0.08)] ${className}`}
      paddingClassName="p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className={`text-lg text-zinc-950 ${titleClassName}`}>
          {title}
        </h2>
        {description ? (
          <div className="group relative flex shrink-0 items-center justify-center">
            <button type="button" className="text-zinc-400 transition hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300 outline-none">
              <Info className="h-5 w-5" />
            </button>
            <div className="pointer-events-none absolute right-0 top-full z-10 mt-2 w-64 origin-top-right scale-95 rounded-2xl bg-zinc-900 dark:bg-white p-3 text-xs leading-5 text-zinc-100 dark:text-zinc-900 opacity-0 shadow-lg transition-all group-hover:pointer-events-auto group-hover:scale-100 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:scale-100 group-focus-within:opacity-100 sm:w-72">
              {description}
            </div>
          </div>
        ) : null}
      </div>
      {children ? <div className={bodyClassName}>{children}</div> : null}
    </SurfaceCard>
  );
}

export function ActionCardInset({
  children,
  className = "",
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`rounded-3xl bg-zinc-50 p-4 text-sm leading-6 text-zinc-600 ${className}`}>
      {children}
    </div>
  );
}

export function ActionCardButton({
  className = "",
  tone = "primary",
  ...props
}: React.ComponentPropsWithoutRef<typeof Button> & {
  tone?: ActionTone;
}) {
  return (
    <Button
      variant={tone}
      shape="rounded-full"
      size="lg"
      fullWidth
      className={className}
      {...props}
    />
  );
}

export function ActionCardLink({
  className = "",
  tone = "secondary",
  href,
  ...props
}: React.ComponentPropsWithoutRef<typeof Button> & {
  tone?: ActionTone;
  href: string;
}) {
  return (
    <Button
      variant={tone}
      shape="rounded-full"
      size="lg"
      fullWidth
      href={href}
      className={className}
      {...props}
    />
  );
}
